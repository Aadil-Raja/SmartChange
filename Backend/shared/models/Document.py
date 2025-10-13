from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
import enum

from .user import Base  # reuse your existing Base

# ---------- Enum for document status ----------
class DocStatus(enum.Enum):
    PENDING = "PENDING"         # record created, file not yet saved
    STORED = "STORED"           # file safely saved (local/S3/MinIO)
    QUEUED = "QUEUED"           # enqueued for background processing
    PROCESSING = "PROCESSING"   # worker currently processing
    PROCESSED = "PROCESSED"     # completed successfully
    FAILED = "FAILED"           # processing failed


# ---------- Document Model ----------
class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)                     # logical title (e.g., “Safety SOP”)
    original_filename = Column(String, nullable=False)          # uploaded filename
    storage_key = Column(String, nullable=False)                # local path or S3 key
    mime_type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)

    status = Column(
        Enum(DocStatus, name="doc_status", create_type=True),
        nullable=False,
        server_default=DocStatus.PENDING.value,
    )

    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # optional relationship (useful when you join documents with users)
    uploader = relationship("User", backref="documents")
