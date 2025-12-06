from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, func, Index, Text, JSON
from sqlalchemy.orm import relationship
import enum

from .user import Base


# ---------- Enum for quiz generation status ----------
class QuizGenerationStatus(enum.Enum):
    QUEUED = "QUEUED"           # Job created, waiting for worker
    GENERATING = "GENERATING"   # Worker actively generating
    COMPLETED = "COMPLETED"     # Successfully finished
    FAILED = "FAILED"           # Failed permanently


# ---------- Enum for quiz generation stage ----------
class QuizGenerationStage(enum.Enum):
    QUEUED = "QUEUED"               # Initial state
    FETCHING_CHUNKS = "FETCHING_CHUNKS"  # Loading document chunks
    SELECTING_CHUNKS = "SELECTING_CHUNKS"  # Smart chunk selection
    CALLING_LLM = "CALLING_LLM"     # Calling Gemini API
    PARSING_RESPONSE = "PARSING_RESPONSE"  # Parsing LLM response
    SAVING_QUESTIONS = "SAVING_QUESTIONS"  # Saving to database
    COMPLETED = "COMPLETED"         # All steps done


# ---------- QuizGenerationAudit Model ----------
class QuizGenerationAudit(Base):
    __tablename__ = "quiz_generation_audit"

    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key to quizzes table
    quiz_id = Column(
        Integer,
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Foreign key to documents table (for reference)
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
        Enum(QuizGenerationStatus, name="quiz_generation_status", create_type=True),
        nullable=False,
        index=True
    )
    
    current_stage = Column(
        Enum(QuizGenerationStage, name="quiz_generation_stage", create_type=True),
        nullable=False
    )
    
    # Timing information
    queued_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Generation parameters
    num_questions_requested = Column(Integer, nullable=False)
    
    # Results metadata
    questions_created = Column(Integer, nullable=True)
    total_chunks = Column(Integer, nullable=True)
    chunks_selected = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    
    # Additional metadata (JSON for flexibility)
    generation_metadata = Column(JSON, nullable=True)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    error_stage = Column(String(50), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    quiz = relationship("Quiz", backref="generation_audits")
    document = relationship("Document", backref="quiz_generation_audits")
    
    # Indexes for efficient queries
    __table_args__ = (
        Index('ix_quiz_audit_quiz_id', 'quiz_id'),
        Index('ix_quiz_audit_document_id', 'document_id'),
        Index('ix_quiz_audit_job_id', 'job_id'),
        Index('ix_quiz_audit_status', 'status'),
        Index('ix_quiz_audit_created_at', 'created_at'),
    )
