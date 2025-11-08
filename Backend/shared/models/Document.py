from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey, func, Index,Text,JSON
from sqlalchemy.orm import relationship
import enum

from .user import Base  # reuse your existing Base
from pgvector.sqlalchemy import Vector


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
    title = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    storage_key = Column(String, nullable=False)
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

    # 🔹 Cloudinary fields (optional)
    cloudinary_url = Column(String, nullable=True)
    cloudinary_public_id = Column(String, nullable=True)
    cloudinary_thumbnail_url = Column(String, nullable=True)

    # 🔹 New JSON column for main topics
    main_topics = Column(
        JSON,
        nullable=False,
        server_default="{}"   # ensures it's never null, default empty JSON
    )

    # Relationship
    uploader = relationship("User", backref="documents")



# ---------- DocumentChunk Model ----------
class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    
    # Primary identification
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer, 
        ForeignKey("documents.id", ondelete="CASCADE"),  # delete chunks when document is deleted
        nullable=False, 
        index=True
    )
    
    # Chunk content
    text = Column(Text, nullable=False)  # the actual chunk text
    
    # Positioning metadata
    chunk_index = Column(Integer, nullable=False)  # 0-indexed position in document
    page_num = Column(Integer, nullable=True)      # source page number (None for non-paginated)
    
    # Character boundaries in original document
    char_start = Column(Integer, nullable=True)
    char_end = Column(Integer, nullable=True)
    
    # Embedding vector (using PostgreSQL array for pgvector compatibility)
    # For Google text-embedding-004: 768 dimensions
    embedding = Column(Vector(768), nullable=True)  # native pgvector type # Will store the vector as array
    
    # Optional structural metadata
    section_title = Column(String, nullable=True)   # e.g., "Payment Terms", "Introduction"
    token_count = Column(Integer, nullable=True)    # tokens in this chunk
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship back to parent document
    document = relationship("Document", backref="chunks")
    
    # Composite index for efficient queries
    __table_args__ = (
        Index('ix_doc_chunk_lookup', 'document_id', 'chunk_index'),
        # For vector similarity search (if using pgvector extension):
        # Index('ix_embedding_vector', 'embedding', postgresql_using='ivfflat', 
        #       postgresql_ops={'embedding': 'vector_cosine_ops'})
    )