"""
Repository for document processing audit records.
Handles CRUD operations for tracking document processing lifecycle.
"""

import logging
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from shared.models import DocumentProcessingAudit, ProcessingStatus, ProcessingStage, Document

logger = logging.getLogger(__name__)


def create_audit_record(
    db: Session,
    document_id: int,
    job_id: str,
    status: ProcessingStatus,
    current_stage: ProcessingStage
) -> DocumentProcessingAudit:
    audit = DocumentProcessingAudit(
        document_id=document_id,
        job_id=str(job_id),
        status=status,
        current_stage=current_stage,
        queued_at=datetime.now()
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    logger.info(f"Created audit record for document {document_id}, job {job_id}, status={status.value}, stage={current_stage.value}")
    return audit


def get_latest_audit(db: Session, document_id: int) -> Optional[DocumentProcessingAudit]:
    return db.query(DocumentProcessingAudit).filter(
        DocumentProcessingAudit.document_id == document_id
    ).order_by(
        DocumentProcessingAudit.created_at.desc()
    ).first()


def update_stage(
    db: Session,
    document_id: int,
    current_stage: ProcessingStage,
    started_at: Optional[datetime] = None
) -> bool:
    audit = get_latest_audit(db, document_id)
    if not audit:
        logger.warning(f"No audit record found for document {document_id}")
        return False
    audit.current_stage = current_stage
    if started_at:
        audit.started_at = started_at
    db.commit()
    logger.info(f"Document {document_id} stage updated -> {current_stage.value}")
    return True


def update_status(
    db: Session,
    document_id: int,
    status: ProcessingStatus
) -> bool:
    audit = get_latest_audit(db, document_id)
    if not audit:
        logger.warning(f"No audit record found for document {document_id}")
        return False
    audit.status = status
    db.commit()
    logger.info(f"Document {document_id} status updated -> {status.value}")
    return True


def update_complete(
    db: Session,
    document_id: int,
    chunks_created: int,
    pages_processed: int
) -> bool:
    audit = get_latest_audit(db, document_id)
    if not audit:
        logger.warning(f"No audit record found for document {document_id}")
        return False
    audit.status = ProcessingStatus.COMPLETED
    audit.current_stage = ProcessingStage.COMPLETED
    audit.completed_at = datetime.now()
    audit.chunks_created = chunks_created
    audit.pages_processed = pages_processed
    db.commit()
    logger.info(f"Document {document_id} completed: {chunks_created} chunks, {pages_processed} pages")
    return True


def update_failed(
    db: Session,
    document_id: int,
    error_message: str,
    error_stage: str
) -> bool:
    audit = get_latest_audit(db, document_id)
    if not audit:
        logger.warning(f"No audit record found for document {document_id}")
        return False
    audit.status = ProcessingStatus.FAILED
    audit.completed_at = datetime.now()
    audit.error_message = error_message
    audit.error_stage = error_stage
    db.commit()
    logger.error(f"Document {document_id} failed at stage {error_stage}: {error_message}")
    return True


def list_all_audits(db: Session) -> List[Tuple[DocumentProcessingAudit, Document]]:
    results = db.query(
        DocumentProcessingAudit, Document
    ).join(
        Document,
        DocumentProcessingAudit.document_id == Document.id
    ).order_by(
        DocumentProcessingAudit.created_at.desc()
    ).all()
    logger.info(f"Retrieved {len(results)} audit records with document info")
    return results
