"""
Repository for QuizGenerationAudit operations.
Tracks quiz generation jobs and their progress.
"""

from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional, List

from shared.models import (
    QuizGenerationAudit,
    QuizGenerationStatus,
    QuizGenerationStage
)


def create_audit(
    db: Session,
    *,
    quiz_id: int,
    document_id: int,
    job_id: str,
    num_questions_requested: int
) -> QuizGenerationAudit:
    """Create a new quiz generation audit record."""
    audit = QuizGenerationAudit(
        quiz_id=quiz_id,
        document_id=document_id,
        job_id=job_id,
        status=QuizGenerationStatus.QUEUED,
        current_stage=QuizGenerationStage.QUEUED,
        queued_at=datetime.now(timezone.utc),
        num_questions_requested=num_questions_requested
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return audit


def get_by_job_id(db: Session, job_id: str) -> Optional[QuizGenerationAudit]:
    """Get audit record by RQ job ID."""
    return db.query(QuizGenerationAudit).filter(
        QuizGenerationAudit.job_id == job_id
    ).first()


def get_by_quiz_id(db: Session, quiz_id: int) -> Optional[QuizGenerationAudit]:
    """Get the most recent audit record for a quiz."""
    return db.query(QuizGenerationAudit).filter(
        QuizGenerationAudit.quiz_id == quiz_id
    ).order_by(QuizGenerationAudit.created_at.desc()).first()


def list_by_document_id(db: Session, document_id: int) -> List[QuizGenerationAudit]:
    """Get all audit records for a document."""
    return db.query(QuizGenerationAudit).filter(
        QuizGenerationAudit.document_id == document_id
    ).order_by(QuizGenerationAudit.created_at.desc()).all()


def update_status(
    db: Session,
    job_id: str,
    status: QuizGenerationStatus,
    stage: Optional[QuizGenerationStage] = None
) -> Optional[QuizGenerationAudit]:
    """Update audit status and optionally stage."""
    audit = get_by_job_id(db, job_id)
    if not audit:
        return None
    
    audit.status = status
    if stage:
        audit.current_stage = stage
    
    # Set timestamps based on status
    if status == QuizGenerationStatus.GENERATING and not audit.started_at:
        audit.started_at = datetime.now(timezone.utc)
    elif status in [QuizGenerationStatus.COMPLETED, QuizGenerationStatus.FAILED]:
        audit.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(audit)
    return audit


def update_stage(
    db: Session,
    job_id: str,
    stage: QuizGenerationStage
) -> Optional[QuizGenerationAudit]:
    """Update current processing stage."""
    audit = get_by_job_id(db, job_id)
    if not audit:
        return None
    
    audit.current_stage = stage
    db.commit()
    db.refresh(audit)
    return audit


def update_results(
    db: Session,
    job_id: str,
    *,
    questions_created: Optional[int] = None,
    total_chunks: Optional[int] = None,
    chunks_selected: Optional[int] = None,
    total_tokens: Optional[int] = None,
    generation_metadata: Optional[dict] = None
) -> Optional[QuizGenerationAudit]:
    """Update audit with generation results."""
    audit = get_by_job_id(db, job_id)
    if not audit:
        return None
    
    if questions_created is not None:
        audit.questions_created = questions_created
    if total_chunks is not None:
        audit.total_chunks = total_chunks
    if chunks_selected is not None:
        audit.chunks_selected = chunks_selected
    if total_tokens is not None:
        audit.total_tokens = total_tokens
    if generation_metadata is not None:
        audit.generation_metadata = generation_metadata
    
    db.commit()
    db.refresh(audit)
    return audit


def update_error(
    db: Session,
    job_id: str,
    error_message: str,
    error_stage: Optional[str] = None
) -> Optional[QuizGenerationAudit]:
    """Update audit with error information."""
    audit = get_by_job_id(db, job_id)
    if not audit:
        return None
    
    audit.status = QuizGenerationStatus.FAILED
    audit.error_message = error_message
    audit.error_stage = error_stage
    audit.completed_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(audit)
    return audit


def list_recent(db: Session, limit: int = 50) -> List[QuizGenerationAudit]:
    """Get recent audit records."""
    return db.query(QuizGenerationAudit).order_by(
        QuizGenerationAudit.created_at.desc()
    ).limit(limit).all()


def list_by_status(db: Session, status: QuizGenerationStatus) -> List[QuizGenerationAudit]:
    """Get all audit records with a specific status."""
    return db.query(QuizGenerationAudit).filter(
        QuizGenerationAudit.status == status
    ).order_by(QuizGenerationAudit.created_at.desc()).all()
