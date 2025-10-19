# app/services/documents_service.py
from sqlalchemy.orm import Session
from app.repositories import documents_repo
from app.services.storage.storage_local import save_bytes
from app.utils.response_utils import make_response
from shared.models import DocStatus  # assuming DocStatus is exported from shared.models
from app.services.queue.factory import get_queue
from rq.job import Job
from app.services.queue.redis_conn import get_redis
from app.core.config import get_settings
from shared.repos.audit_repo import get_audit_repo
from shared.models.Audit import ProcessingStatus, ProcessingStage

settings = get_settings()

def _doc_to_dict(row) -> dict:
    doc, uploader_email = row  # unpack tuple from join query
    return {
        "id": doc.id,
        "title": doc.title,
        "original_filename": doc.original_filename,
        "storage_key": doc.storage_key,
        "mime_type": doc.mime_type,
        "size_bytes": doc.size_bytes,
        "status": doc.status.value,
        "uploader_email": uploader_email,  # pulled from join
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
    }

def upload_document_local(
    db: Session,
    *,
    user_id: int,
    file_bytes: bytes,
    filename: str,
    mime: str | None = None,
    title: str | None = None,
):
    """
    Save file to local storage, then create a Document row.
    Returns a make_response payload (201).
    """
    # 1) store bytes to disk
    storage_key = save_bytes(
        file_bytes,
        user_id=user_id,
        original_name=filename,
    )

    # 2) create DB row
    doc = documents_repo.create_document(
        db,
        title=title or filename,
        original_filename=filename,
        storage_key=storage_key,
        mime_type=mime or "application/octet-stream",
        size_bytes=len(file_bytes),
        uploaded_by=user_id,
        status=DocStatus.STORED,
    )
    
    return make_response(
        True,
        "Document uploaded successfully",
        data={"document": doc},
        status_code=201,
    )

def list_documents(db: Session):
    """
    Get all documents (joined with uploader email).
    """
    rows = documents_repo.list_documents(db)

    return make_response(
        True,
        "Documents retrieved successfully",
        data={
            "documents": [_doc_to_dict(r) for r in rows],
            "count": len(rows),
        },
        status_code=200,
    )

RQ_TASK = settings.rq_process_task  

def queue_document(db, *, document_id: int):
    doc = documents_repo.get_document(db, document_id)
    if not doc:
        return make_response(False, "Document not found", status_code=404)
    
    # If already queued/processing/processed, make this idempotent
    if doc.status in {DocStatus.QUEUED, DocStatus.PROCESSING, DocStatus.PROCESSED}:
        return make_response(True, "Already queued or processed", data={"document_id": doc.id, "status": doc.status.value}, status_code=200)
   
    q = get_queue()

    job = q.enqueue(RQ_TASK, document_id=doc.id)
    
    documents_repo.update_status(db, document_id=doc.id, status=DocStatus.QUEUED)

    # Create audit record
    audit_repo = get_audit_repo(db)
    audit_repo.create_audit_record(
        document_id=doc.id,
        job_id=job.id,
        status=ProcessingStatus.QUEUED,
        current_stage=ProcessingStage.QUEUED,
        attempt_number=1
    )

    return make_response(
        True,
        "Document queued for processing",
        data={"document_id": doc.id, "job_id": job.id, "status": DocStatus.QUEUED.value},
        status_code=202,
    )

def get_job_info(job_id: str):
    conn = get_redis()
    try:
        job = Job.fetch(job_id, connection=conn)
    except Exception:
        return make_response(False, "Job not found", status_code=404)

    return make_response(
        True,
        "Job fetched",
        data={
            "id": job.id,
            "status": job.get_status(),
            "created_at": job.created_at,
            "enqueued_at": job.enqueued_at,
            "started_at": job.started_at,
            "ended_at": job.ended_at,
            "result": job.result,         # None unless your task returns something
            "exc_info": job.exc_info,     # traceback string if failed
        },
        status_code=200,
    )

def list_processing_jobs(db: Session):
    """
    Get all processing jobs with calculated fields and statistics.
    
    Returns:
        Response with jobs list and summary statistics
    """
    from datetime import datetime
    
    audit_repo = get_audit_repo(db)
    audits = audit_repo.list_all_audits()
    
    jobs = []
    stats = {"queued": 0, "processing": 0, "completed": 0, "failed": 0}
    
    # Stage to progress percentage mapping
    stage_progress = {
        ProcessingStage.QUEUED: 0,
        ProcessingStage.LOADING: 20,
        ProcessingStage.PREPROCESSING: 40,
        ProcessingStage.CHUNKING: 60,
        ProcessingStage.EMBEDDING: 80,
        ProcessingStage.STORING: 90,
        ProcessingStage.COMPLETED: 100
    }
    
    for audit, document in audits:
        # Calculate time elapsed
        if audit.started_at:
            end_time = audit.completed_at or datetime.now()
            elapsed = (end_time - audit.started_at).total_seconds()
        else:
            elapsed = 0
        
        # Calculate progress percentage
        progress = stage_progress.get(audit.current_stage, 0)
        
        jobs.append({
            "document_id": audit.document_id,
            "document_title": document.title,
            "job_id": audit.job_id,
            "status": audit.status.value,
            "current_stage": audit.current_stage.value,
            "progress_percentage": progress,
            "time_elapsed_seconds": elapsed,
            "queued_at": audit.queued_at,
            "started_at": audit.started_at,
            "completed_at": audit.completed_at,
            "chunks_created": audit.chunks_created,
            "pages_processed": audit.pages_processed,
            "error_message": audit.error_message,
            "error_stage": audit.error_stage
        })
        
        # Update stats
        stats[audit.status.value.lower()] += 1
    
    return make_response(
        True,
        "Processing jobs retrieved",
        data={"jobs": jobs, "total": len(jobs), "stats": stats},
        status_code=200
    )