from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Index, func
from sqlalchemy.orm import relationship

from .user import Base


class DocumentSection(Base):
    """
    Represents a section within a document with chunk boundaries.
    Used for efficient section-based summarization and retrieval.
    """
    __tablename__ = "document_sections"
    
    # Primary key
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign key to document (CASCADE delete - remove sections when document is deleted)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Section identification
    section_title = Column(String, nullable=False)  # e.g., "Payment Terms", "Introduction"
    
    # Chunk boundaries (inclusive range)
    start_chunk_index = Column(Integer, nullable=False)  # First chunk index for this section
    end_chunk_index = Column(Integer, nullable=False)    # Last chunk index for this section
    
    # Computed metadata
    chunk_count = Column(Integer, nullable=False)  # Number of chunks in this section
    
    # Summary caching (NULL until first generation)
    summary = Column(Text, nullable=True)  # Stores generated summary text
    summary_generated_at = Column(DateTime(timezone=True), nullable=True)  # When summary was created
    summary_token_count = Column(Integer, nullable=True)  # Size of summary (optional)
    summary_model = Column(String, nullable=True)  # Which LLM generated it (e.g., "gemini-1.5-pro")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationship back to parent document
    document = relationship("Document", backref="sections")
    
    # Composite indexes for efficient queries
    __table_args__ = (
        # Fast lookup by document and section title
        Index('ix_doc_section_lookup', 'document_id', 'section_title'),
        # Efficient range queries for chunk retrieval
        Index('ix_doc_section_boundaries', 'document_id', 'start_chunk_index', 'end_chunk_index'),
    )
    
    def __repr__(self):
        return (
            f"<DocumentSection(id={self.id}, document_id={self.document_id}, "
            f"title='{self.section_title}', chunks={self.chunk_count}, "
            f"has_summary={self.summary is not None})>"
        )
