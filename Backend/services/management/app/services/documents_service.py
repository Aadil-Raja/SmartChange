# app/services/documents_service.py
from sqlalchemy.orm import Session
from shared.repos import documents_repo
from app.services.storage.storage_local import save_bytes
from app.services.storage.storage_cloudinary import upload_raw_bytes
from app.utils.response_utils import make_response
from shared.models import DocStatus  # assuming DocStatus is exported from shared.models
from app.services.queue.factory import get_queue
from rq.job import Job
from app.services.queue.redis_conn import get_redis
from app.core.config import get_settings
import sys, traceback
from shared.repos import audit_repo
from shared.models.Audit import ProcessingStatus, ProcessingStage
from app.services.storage.storage_cloudinary import upload_document_bytes
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
        "cloudinary_url": doc.cloudinary_url,           # handy for preview/open
        "cloudinary_public_id": doc.cloudinary_public_id,
        "cloudinary_thumbnail_url": doc.cloudinary_thumbnail_url,
        "main_topics": doc.main_topics,  # 🆕 NEW FIELD
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


def upload_document_dual(
    db,
    *,
    user_id: int,
    file_bytes: bytes,
    filename: str,
    mime: str | None = None,
    title: str | None = None,
    fail_if_cloudinary_fails: bool = False,
):
    """
    Save document to both local storage and Cloudinary.
    Uses the new upload_document_bytes function for Cloudinary with thumbnail generation.
    """
    print(f"[upload_document_dual] Start uploading document for user_id={user_id}, filename={filename}", file=sys.stderr)

    # 1) Save locally + DB row
    try:
        storage_key = save_bytes(
            file_bytes,
            user_id=user_id,
            original_name=filename,
        )
        print(f"[upload_document_dual] File saved locally at {storage_key}", file=sys.stderr)
    except Exception as e:
        print("[upload_document_dual] ERROR saving file locally:", e, file=sys.stderr)
        traceback.print_exc()
        return make_response(False, f"Local file save failed: {e}", status_code=500)

    try:
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
        print(f"[upload_document_dual] Document row created with ID={doc.id}", file=sys.stderr)
    except Exception as e:
        print("[upload_document_dual] ERROR creating document row:", e, file=sys.stderr)
        return make_response(False, f"DB insert failed: {e}", status_code=500)

    cloud_info = None
    cloud_err = None

    # 2) Upload to Cloudinary using the new upload_document_bytes function 🆕 CHANGED
    try:
        print("[upload_document_dual] Uploading file to Cloudinary...", file=sys.stderr)
        result = upload_document_bytes(  # 🆕 USING NEW FUNCTION
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime
        )
        print(f"[upload_document_dual] Cloudinary upload result: {result}", file=sys.stderr)

        secure_url = result.get("secure_url")
        public_id = result.get("public_id")
        thumbnail_url = result.get("thumbnail_url")  # 🆕 NEW LINE

        if secure_url:
            doc = documents_repo.attach_cloudinary_fields(
                db,
                document_id=doc.id,
                url=secure_url,
                public_id=public_id,
                thumbnail_url=thumbnail_url,  # 🆕 NEW PARAMETER
            )
            cloud_info = {
                "cloudinary_url": secure_url,
                "cloudinary_public_id": public_id,
                "cloudinary_thumbnail_url": thumbnail_url,  # 🆕 NEW LINE
            }
            print(f"[upload_document_dual] Cloudinary fields attached for doc_id={doc.id}", file=sys.stderr)
        else:
            print("[upload_document_dual] No secure_url returned from Cloudinary!", file=sys.stderr)

    except Exception as e:
        cloud_err = str(e)
        print("[upload_document_dual] ERROR during Cloudinary upload:", e, file=sys.stderr)
        traceback.print_exc()
     
        if fail_if_cloudinary_fails:
            return make_response(False, f"Cloud upload failed: {cloud_err}", status_code=500)

    data = {"document": doc}

    if cloud_err:
        data["cloudinary_error"] = cloud_err
        print(f"[upload_document_dual] Cloudinary upload failed gracefully: {cloud_err}", file=sys.stderr)

    print("[upload_document_dual] Upload process completed successfully.", file=sys.stderr)
    return make_response(True, "Document uploaded successfully", data=data, status_code=201)

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
    if doc.status in {DocStatus.PROCESSED, DocStatus.QUEUED, DocStatus.PROCESSING}:
        return make_response(True, f"Already {doc.status.value}", data={"document_id": doc.id, "status": doc.status.value}, status_code=200)
   
    q = get_queue()

    job_id = q.enqueue(RQ_TASK, document_id=doc.id)
    
    documents_repo.update_status(db, document_id=doc.id, status=DocStatus.QUEUED)

    # Create audit record
    audit_repo.create_audit_record(
        db,
        document_id=doc.id,
        job_id=job_id,
        status=ProcessingStatus.QUEUED,
        current_stage=ProcessingStage.QUEUED
    )

    return make_response(
        True,
        "Document queued for processing",
        data={"document_id": doc.id, "job_id": job_id, "status": DocStatus.QUEUED.value},
        status_code=202,
    )


def reprocess_document(db, *, document_id: int):
    """
    Force reprocess a document even if already PROCESSED.
    Deletes all chunks and requeues for complete reprocessing.
    """
    from shared.repos import chunks_repo
    
    doc = documents_repo.get_document(db, document_id)
    if not doc:
        return make_response(False, "Document not found", status_code=404)
    
    # Delete all existing chunks
    deleted_count = chunks_repo.delete_by_document(db, document_id)
    
    # Reset document status to STORED
    documents_repo.update_status(db, document_id=doc.id, status=DocStatus.STORED)
    
    # Queue for reprocessing
    q = get_queue()
    job_id = q.enqueue(RQ_TASK, document_id=doc.id)
    
    # Update status to QUEUED
    documents_repo.update_status(db, document_id=doc.id, status=DocStatus.QUEUED)
    
    # Create new audit record
    audit_repo.create_audit_record(
        db,
        document_id=doc.id,
        job_id=job_id,
        status=ProcessingStatus.QUEUED,
        current_stage=ProcessingStage.QUEUED
    )
    
    return make_response(
        True,
        "Document queued for reprocessing",
        data={
            "document_id": doc.id,
            "job_id": job_id,
            "status": DocStatus.QUEUED.value,
            "chunks_deleted": deleted_count
        },
        status_code=202,
    )


def resume_processing(db, *, document_id: int):
    """
    Resume processing from where it failed based on the last audit stage.
    
    Determines the last successful stage and resumes from the next stage:
    - LOADING failed → Start from LOADING
    - PREPROCESSING failed → Start from PREPROCESSING
    - CHUNKING failed → Start from CHUNKING
    - EMBEDDING failed → Delete chunks, start from CHUNKING
    - STORING failed → Delete chunks, start from CHUNKING
    """
    from shared.repos import chunks_repo
    
    doc = documents_repo.get_document(db, document_id)
    if not doc:
        return make_response(False, "Document not found", status_code=404)
    
    # Get the latest audit record for this document
    latest_audit = audit_repo.get_latest_audit(db, document_id=document_id)
    
    if not latest_audit:
        return make_response(
            False,
            "No processing history found. Use /queue endpoint instead.",
            status_code=400
        )
    
    if latest_audit.status == ProcessingStatus.COMPLETED:
        return make_response(
            False,
            "Document already completed. Use /reprocess to start over.",
            status_code=400
        )
    
    # Determine resume strategy based on failed stage
    failed_stage = latest_audit.current_stage
    resume_from = None
    chunks_deleted = 0
    
    if failed_stage in [ProcessingStage.QUEUED, ProcessingStage.LOADING, ProcessingStage.PREPROCESSING]:
        # Early stages - just restart from beginning
        resume_from = ProcessingStage.LOADING
        documents_repo.update_status(db, document_id=doc.id, status=DocStatus.STORED)
        
    elif failed_stage == ProcessingStage.CHUNKING:
        # Chunking failed - restart chunking
        resume_from = ProcessingStage.CHUNKING
        documents_repo.update_status(db, document_id=doc.id, status=DocStatus.STORED)
        
    elif failed_stage in [ProcessingStage.EMBEDDING, ProcessingStage.STORING]:
        # Embedding or storing failed - delete partial chunks and restart from chunking
        chunks_deleted = chunks_repo.delete_by_document(db, document_id)
        resume_from = ProcessingStage.CHUNKING
        documents_repo.update_status(db, document_id=doc.id, status=DocStatus.STORED)
    
    else:
        return make_response(
            False,
            f"Cannot resume from stage: {failed_stage.value}",
            status_code=400
        )
    
    # Queue for processing
    q = get_queue()
    job_id = q.enqueue(RQ_TASK, document_id=doc.id)
    
    # Update status to QUEUED
    documents_repo.update_status(db, document_id=doc.id, status=DocStatus.QUEUED)
    
    # Create new audit record
    audit_repo.create_audit_record(
        db,
        document_id=doc.id,
        job_id=job_id,
        status=ProcessingStatus.QUEUED,
        current_stage=ProcessingStage.QUEUED
    )
    
    return make_response(
        True,
        f"Document queued to resume from {resume_from.value}",
        data={
            "document_id": doc.id,
            "job_id": job_id,
            "status": DocStatus.QUEUED.value,
            "failed_stage": failed_stage.value,
            "resume_from": resume_from.value,
            "chunks_deleted": chunks_deleted
        },
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
    
    audits = audit_repo.list_all_audits(db)
    
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
          
            "document_title": document.title,
          
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


# 🆕 NEW FUNCTION: Update main topics
def update_main_topics(db: Session, *, document_id: int, main_topics: dict):
    """
    Update the main topics for a document.
    Topics are stored as key-value pairs (topic name -> description/sub-topics).
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        main_topics: Dictionary of {topic_name: description}
        
    Returns:
        Response with updated document
    """
    print(f"[update_main_topics] Updating topics for document_id={document_id}", file=sys.stderr)
    print(f"[update_main_topics] Topics data: {main_topics}", file=sys.stderr)
    
    try:
        doc = documents_repo.update_main_topics(db, document_id=document_id, main_topics=main_topics)
        
        if not doc:
            return make_response(False, "Document not found", status_code=404)
        
        print(f"[update_main_topics] Topics updated successfully for doc_id={document_id}", file=sys.stderr)
        
        return make_response(
            True,
            "Main topics updated successfully",
            data={
                "document_id": doc.id,
                "main_topics": doc.main_topics,
                "updated_at": doc.updated_at
            },
            status_code=200
        )
    except Exception as e:
        print(f"[update_main_topics] ERROR updating topics: {e}", file=sys.stderr)
        traceback.print_exc()
        return make_response(False, f"Failed to update topics: {str(e)}", status_code=500)


# 🆕 NEW FUNCTION: Get all unique main topics with their descriptions
def list_main_topics(db: Session, *, document_id: int):
    """
    Get all unique main topics across all documents with their descriptions.
    Returns a merged view of all topics with example descriptions.
    
    Returns:
        Response with dictionary of unique topics and their descriptions
    """
    print("[list_main_topics] Fetching all main topics", file=sys.stderr)
    
    try:
        topics_dict = documents_repo.get_all_main_topics(db,document_id=document_id)
        
       
        
        return make_response(
            True,
            "Main topics retrieved successfully",
            data={
                "topics": topics_dict
            
            },
            status_code=200
        )
    except Exception as e:
        print(f"[list_main_topics] ERROR fetching topics: {e}", file=sys.stderr)
        traceback.print_exc()
        return make_response(False, f"Failed to retrieve topics: {str(e)}", status_code=500)


# 🆕 NEW FUNCTION: AI-Generated Main Topics
def generate_main_topics_ai(db: Session, *, document_id: int):
    """
    Generate main topics for a document using AI.
    
    Process:
    1. Check document status (must be PROCESSED)
    2. Query all chunks for the document
    3. Group chunks by section_title (first 3 per section)
    4. Extract first line from each chunk
    5. Call Gemini to generate topics JSON
    6. Save to database
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Response with generated topics
    """
    import google.generativeai as genai
    import json
    import re
    from shared.models import DocumentChunk
    
    print(f"[generate_main_topics_ai] Starting for document_id={document_id}", file=sys.stderr)
    
    try:
        # Step 1: Check document exists and is PROCESSED
        doc = documents_repo.get_by_id(db, document_id)
        if not doc:
            return make_response(False, "Document not found", status_code=404)
        
        if doc.status != DocStatus.PROCESSED:
            return make_response(
                False, 
                f"Document must be PROCESSED to generate topics. Current status: {doc.status.value}",
                status_code=400
            )
        
        print(f"[generate_main_topics_ai] Document '{doc.title}' is PROCESSED", file=sys.stderr)
        
        # Step 2: Query all chunks ordered by chunk_index
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()
        
        if not chunks:
            return make_response(
                False,
                "No chunks found for this document. Document may not have been processed correctly.",
                status_code=400
            )
        
        print(f"[generate_main_topics_ai] Found {len(chunks)} chunks", file=sys.stderr)
        
        # Step 3: Group chunks by section_title (first 3 per section)
        section_map = {}  # {section_title: [first_lines]}
        
        for chunk in chunks:
            section_title = chunk.section_title
            
            # If no section_title, extract first line as section name
            if not section_title:
                section_title = _extract_first_line(chunk.text)
                if not section_title:
                    section_title = "General Content"
            
            # Initialize list for this section
            if section_title not in section_map:
                section_map[section_title] = []
            
            # Only keep first 3 chunks per section
            if len(section_map[section_title]) < 3:
                first_line = _extract_first_line(chunk.text)
                if first_line:
                    section_map[section_title].append(first_line)
        
        print(f"[generate_main_topics_ai] Grouped into {len(section_map)} sections", file=sys.stderr)
        
        # Step 4: Build context for LLM
        section_summaries = {}
        for section, lines in section_map.items():
            # Join lines with comma
            section_summaries[section] = ", ".join(lines)
        
        # Step 5: Call LLM to generate topics using wrapper
        from shared.llm import create_llm_provider
        
        try:
            # Create LLM provider using shared utility
            llm = create_llm_provider(
                llm_provider=settings.llm_provider,
                llm_model=settings.llm_model,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key
            )
            
            print(f"[generate_main_topics_ai] Using {settings.llm_provider} provider with model {settings.llm_model}", file=sys.stderr)
            
        except ValueError as e:
            return make_response(
                False,
                f"LLM configuration error: {str(e)}",
                status_code=500
            )
        
        # Build prompt
        sections_text = "\n\n".join([
            f"Section: {section}\nContent: {summary}"
            for section, summary in section_summaries.items()
        ])
        
        prompt = f"""Based on the following document sections and their content, generate a JSON object with main topics.

Document: {doc.title}

Sections and Content:
{sections_text}

Generate a JSON object where:
- Keys are topic names (concise, 2-5 words, use the section names as guidance)
- Values are descriptions that PRESERVE IMPORTANT KEYWORDS from the content

CRITICAL RULES FOR DESCRIPTIONS:
1. Include as many specific keywords, terms, and concepts from the content as possible
2. Use comma-separated lists of key terms (this helps with semantic search)
3. Preserve technical terms, acronyms, and domain-specific vocabulary exactly as they appear
4. Keep descriptions informative but keyword-rich (1-2 sentences)
5. Prioritize nouns, technical terms, and action verbs from the original content

Example format:
{{
  "User Authentication": "Authentication principles, password-based authentication, token-based authentication, JWT tokens, OAuth 2.0, biometric systems, session management, multi-factor authentication",
  "Access Control": "Access control principles, DAC implementation, UNIX file security, RBAC models, ABAC models, role-based access, attribute-based access, authorization patterns, permission management"
}}

Return ONLY valid JSON, no markdown formatting or extra text.

Generate the topics JSON now:"""
        
        print(f"[generate_main_topics_ai] Calling LLM...", file=sys.stderr)
        
        # Use wrapper's generate_json method (handles JSON parsing automatically)
        try:
            main_topics = llm.generate_json(prompt)
            
            if not isinstance(main_topics, dict):
                raise ValueError("Response is not a dictionary")
            
            print(f"[generate_main_topics_ai] Parsed {len(main_topics)} topics", file=sys.stderr)
            
        except Exception as e:
            print(f"[generate_main_topics_ai] LLM error: {e}", file=sys.stderr)
            
            # Fallback: use section titles as topics
            main_topics = {
                section: f"Content related to {section}"
                for section in section_summaries.keys()
            }
            print(f"[generate_main_topics_ai] Using fallback topics", file=sys.stderr)
        
        # Step 6: Save to database
        updated_doc = documents_repo.update_main_topics(
            db,
            document_id=document_id,
            main_topics=main_topics
        )
        
        if not updated_doc:
            return make_response(False, "Failed to save topics to database", status_code=500)
        
        print(f"[generate_main_topics_ai] ✓ Topics saved successfully", file=sys.stderr)
        
        return make_response(
            True,
            "Main topics generated successfully",
            data={
                "document_id": document_id,
                "main_topics": main_topics,
                "chunks_analyzed": len(chunks),
                "sections_found": len(section_map)
            },
            status_code=200
        )
        
    except Exception as e:
        print(f"[generate_main_topics_ai] ERROR: {e}", file=sys.stderr)
        traceback.print_exc()
        return make_response(
            False,
            f"Failed to generate topics: {str(e)}",
            status_code=500,
            error=str(e)
        )


def get_document_sections_with_preview(db: Session, *, document_id: int):
    """
    Get all sections for a document with actual chunk text previews.
    For each section, fetches:
      - The first chunk (start_chunk_index) → first 2 lines of text
      - The last chunk (end_chunk_index)   → last 2 lines of text
    """
    from shared.models.DocumentSection import DocumentSection
    from shared.models.Document import DocumentChunk

    doc = documents_repo.get_document(db, document_id)
    if not doc:
        return make_response(False, "Document not found", status_code=404)

    sections = (
        db.query(DocumentSection)
        .filter(DocumentSection.document_id == document_id)
        .order_by(DocumentSection.start_chunk_index)
        .all()
    )

    def first_two_lines(text: str) -> str:
        if not text:
            return ""
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        preview = " ".join(lines[:2])
        return preview[:150] + "…" if len(preview) > 150 else preview

    def last_two_lines(text: str) -> str:
        if not text:
            return ""
        lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
        preview = " ".join(lines[-2:])
        return preview[:150] + "…" if len(preview) > 150 else preview

    def get_chunk_text(chunk_index: int) -> str:
        chunk = (
            db.query(DocumentChunk)
            .filter(
                DocumentChunk.document_id == document_id,
                DocumentChunk.chunk_index == chunk_index,
            )
            .first()
        )
        return chunk.text if chunk else ""

    data = []
    for s in sections:
        start_text = get_chunk_text(s.start_chunk_index)
        # Only fetch end chunk separately if it's a different chunk
        if s.start_chunk_index == s.end_chunk_index:
            end_text = start_text
        else:
            end_text = get_chunk_text(s.end_chunk_index)
        data.append({
            "id": s.id,
            "section_title": s.section_title,
            "chunk_count": s.chunk_count,
            "start_preview": first_two_lines(start_text),
            "end_preview": last_two_lines(end_text),
            "single_chunk": s.start_chunk_index == s.end_chunk_index,
        })

    return make_response(
        True,
        "Sections retrieved successfully",
        data={"sections": data, "count": len(data)},
        status_code=200,
    )

    """
    Extract first line from text.
    Up to first period (.) or max 100-120 characters.
    
    Args:
        text: Input text
        
    Returns:
        First line (cleaned)
    """
    if not text:
        return ""
    
    # Clean text
    text = text.strip()
    
    # Find first period
    period_idx = text.find('.')
    
    if period_idx > 0:
        # Use text up to period
        first_line = text[:period_idx + 1]
    else:
        # No period found, use first 120 chars
        first_line = text[:120]
    
    # Ensure we don't exceed 120 chars
    if len(first_line) > 120:
        first_line = first_line[:120].strip() + "..."
    
    return first_line.strip()
