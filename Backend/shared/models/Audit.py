from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, func, Index, Text
from sqlalchemy.orm import relationship
import enum

from .user import Base  # reuse existing Base


# ---------- Enum for processing status ----------
class ProcessingStatus(enum.Enum):
    QUEUED = "QUEUED"           # Job created, waiting for worker
    PROCESSING = "PROCESSING"   # Worker actively processing
    COMPLETED = "COMPLETED"     # Successfully finished
    FAILED = "FAILED"           # Failed permanently


# ---------- Enum for processing stage ----------
class ProcessingStage(enum.Enum):
    QUEUED = "QUEUED"               # Initial state
    LOADING = "LOADING"             # Loading document from storage
    PREPROCESSING = "PREPROCESSING" # Cleaning and segmenting text
    CHUNKING = "CHUNKING"           # Creating chunks
    EMBEDDING = "EMBEDDING"         # Generating embeddings
    STORING = "STORING"             # Saving to database
    COMPLETED = "COMPLETED"         # All steps done


# ---------- DocumentProcessingAudit Model ----------
class DocumentProcessingAudit(Base):
    __tablename__ = "document_processing_audit"

    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key to documents table
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # RQ job identifier
    job_id = Column(String(255), nullable=False, index=True)
    
    # Status tracking
    status = Column(
        Enum(ProcessingStatus, name="processing_status", create_type=True),
        nullable=False,
        index=True
    )
    
    current_stage = Column(
        Enum(ProcessingStage, name="processing_stage", create_type=True),
        nullable=False
    )
    
    # Timing information
    queued_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Results metadata
    chunks_created = Column(Integer, nullable=True)
    pages_processed = Column(Integer, nullable=True)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    error_stage = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship back to parent document
    document = relationship("Document", backref="processing_audits")
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('ix_audit_document_id', 'document_id'),
        Index('ix_audit_job_id', 'job_id'),
        Index('ix_audit_status', 'status'),
        Index('ix_audit_created_at', 'created_at'),
    )
