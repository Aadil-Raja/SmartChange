"""
Shared repository for document chunks - essential CRUD operations.
Used across multiple services (management, chatbot, processing_worker).
"""

import logging
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import delete

from shared.models.Document import DocumentChunk
from shared.models.DocumentSection import DocumentSection

logger = logging.getLogger(__name__)


def delete_by_document(db: Session, document_id: int) -> int:
    """
    Delete all chunks and sections for a document.
    
    Note: DocumentSection records are automatically deleted via CASCADE,
    but we delete them explicitly for clarity and to get the count.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Number of chunks deleted
    """
    # Delete sections first (explicit, though CASCADE would handle it)
    sections_result = db.execute(
        delete(DocumentSection).where(DocumentSection.document_id == document_id)
    )
    sections_deleted = sections_result.rowcount
    
    # Delete chunks
    chunks_result = db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    chunks_deleted = chunks_result.rowcount
    
    db.commit()
    
    logger.info(
        f"Deleted {chunks_deleted} chunks and {sections_deleted} sections "
        f"for document {document_id}"
    )
    return chunks_deleted


def count_by_document(db: Session, document_id: int) -> int:
    """
    Count chunks for a document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Chunk count
    """
    count = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).count()
    return count


def get_by_document(
    db: Session,
    document_id: int,
    include_embeddings: bool = False
) -> List[DocumentChunk]:
    """
    Get all chunks for a document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        include_embeddings: Whether to load embedding vectors (can be large)
        
    Returns:
        List of DocumentChunk records ordered by chunk_index
    """
    query = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    )
    
    if not include_embeddings:
        # Defer loading embedding column for performance
        from sqlalchemy.orm import defer
        query = query.options(defer(DocumentChunk.embedding))
    
    chunks = query.order_by(DocumentChunk.chunk_index).all()
    logger.info(f"Retrieved {len(chunks)} chunks for document {document_id}")
    return chunks


def get_by_id(db: Session, chunk_id: int) -> Optional[DocumentChunk]:
    """
    Get a single chunk by ID.
    
    Args:
        db: SQLAlchemy session
        chunk_id: Chunk ID
        
    Returns:
        DocumentChunk or None if not found
    """
    return db.query(DocumentChunk).filter(
        DocumentChunk.id == chunk_id
    ).first()
