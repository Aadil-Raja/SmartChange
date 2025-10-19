"""
Repository for document processing audit records.
Handles CRUD operations for tracking document processing lifecycle.
"""

import logging
from typing import Optional, List, Tuple
from datetime import datetime
from sqlalchemy.orm import Session, joinedload

from shared.models import DocumentProcessingAudit, ProcessingStatus, ProcessingStage, Document

logger = logging.getLogger(__name__)


class AuditRepository:
    """Repository for managing document processing audit records."""
    
    def __init__(self, db: Session):
        """
        Initialize repository with database session.
        
        Args:
            db: SQLAlchemy session
        """
        self.db = db
    
    def create_audit_record(
        self,
        document_id: int,
        job_id: str,
        status: ProcessingStatus,
        current_stage: ProcessingStage,
        attempt_number: int = 1
    ) -> DocumentProcessingAudit:
        """
        Create a new audit record for a document processing job.
        
        Args:
            document_id: ID of the document being processed
            job_id: RQ job identifier
            status: Initial processing status
            current_stage: Initial processing stage
            attempt_number: Attempt number for retry tracking (default: 1)
            
        Returns:
            Created DocumentProcessingAudit record
        """
        audit = DocumentProcessingAudit(
            document_id=document_id,
            job_id=job_id,
            status=status,
            current_stage=current_stage,
            queued_at=datetime.now(),
            attempt_number=attempt_number
        )
        
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(audit)
        
        logger.info(
            f"Created audit record for document {document_id}, "
            f"job {job_id}, status={status.value}, stage={current_stage.value}"
        )
        
        return audit
    
    def get_latest_audit(self, document_id: int) -> Optional[DocumentProcessingAudit]:
        """
        Get the most recent audit record for a document.
        
        Args:
            document_id: Document ID
            
        Returns:
            Latest DocumentProcessingAudit record or None if not found
        """
        return self.db.query(DocumentProcessingAudit).filter(
            DocumentProcessingAudit.document_id == document_id
        ).order_by(
            DocumentProcessingAudit.created_at.desc()
        ).first()
    
    def update_stage(
        self,
        document_id: int,
        current_stage: ProcessingStage,
        started_at: Optional[datetime] = None
    ) -> bool:
        """
        Update the current processing stage for a document.
        
        Args:
            document_id: Document ID
            current_stage: New processing stage
            started_at: Optional timestamp when processing started
            
        Returns:
            True if updated, False if audit record not found
        """
        audit = self.get_latest_audit(document_id)
        if not audit:
            logger.warning(f"No audit record found for document {document_id}")
            return False
        
        old_stage = audit.current_stage
        audit.current_stage = current_stage
        
        if started_at:
            audit.started_at = started_at
        
        self.db.commit()
        
        logger.info(
            f"Document {document_id} stage updated: {old_stage.value} -> {current_stage.value}"
        )
        
        return True
    
    def update_status(
        self,
        document_id: int,
        status: ProcessingStatus
    ) -> bool:
        """
        Update the processing status for a document.
        
        Args:
            document_id: Document ID
            status: New processing status
            
        Returns:
            True if updated, False if audit record not found
        """
        audit = self.get_latest_audit(document_id)
        if not audit:
            logger.warning(f"No audit record found for document {document_id}")
            return False
        
        old_status = audit.status
        audit.status = status
        
        self.db.commit()
        
        logger.info(
            f"Document {document_id} status updated: {old_status.value} -> {status.value}"
        )
        
        return True
    
    def update_complete(
        self,
        document_id: int,
        chunks_created: int,
        pages_processed: int
    ) -> bool:
        """
        Mark a document processing job as completed with results.
        
        Args:
            document_id: Document ID
            chunks_created: Number of chunks created
            pages_processed: Number of pages processed
            
        Returns:
            True if updated, False if audit record not found
        """
        audit = self.get_latest_audit(document_id)
        if not audit:
            logger.warning(f"No audit record found for document {document_id}")
            return False
        
        audit.status = ProcessingStatus.COMPLETED
        audit.current_stage = ProcessingStage.COMPLETED
        audit.completed_at = datetime.now()
        audit.chunks_created = chunks_created
        audit.pages_processed = pages_processed
        
        self.db.commit()
        
        logger.info(
            f"Document {document_id} completed: "
            f"{chunks_created} chunks, {pages_processed} pages"
        )
        
        return True
    
    def update_failed(
        self,
        document_id: int,
        error_message: str,
        error_stage: str
    ) -> bool:
        """
        Mark a document processing job as failed with error details.
        
        Args:
            document_id: Document ID
            error_message: Error message describing the failure
            error_stage: Stage where the failure occurred
            
        Returns:
            True if updated, False if audit record not found
        """
        audit = self.get_latest_audit(document_id)
        if not audit:
            logger.warning(f"No audit record found for document {document_id}")
            return False
        
        audit.status = ProcessingStatus.FAILED
        audit.completed_at = datetime.now()
        audit.error_message = error_message
        audit.error_stage = error_stage
        
        self.db.commit()
        
        logger.error(
            f"Document {document_id} failed at stage {error_stage}: {error_message}"
        )
        
        return True
    
    def list_all_audits(self) -> List[Tuple[DocumentProcessingAudit, Document]]:
        """
        Get all audit records with their associated document information.
        Uses a join to fetch document details in a single query.
        
        Returns:
            List of tuples containing (DocumentProcessingAudit, Document)
        """
        results = self.db.query(
            DocumentProcessingAudit, Document
        ).join(
            Document,
            DocumentProcessingAudit.document_id == Document.id
        ).order_by(
            DocumentProcessingAudit.created_at.desc()
        ).all()
        
        logger.info(f"Retrieved {len(results)} audit records with document info")
        
        return results


def get_audit_repo(db: Session) -> AuditRepository:
    """
    Factory function to create an AuditRepository instance.
    
    Args:
        db: SQLAlchemy session
        
    Returns:
        AuditRepository instance
    """
    return AuditRepository(db)
