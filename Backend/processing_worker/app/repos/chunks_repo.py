"""
Repository for document chunks - handles CRUD operations.
Manages bulk insert, retrieval, and deletion of chunks with embeddings.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import delete

from shared.models.Document import DocumentChunk

logger = logging.getLogger(__name__)


def bulk_insert(
    db: Session,
    document_id: int,
    chunks: List[Any],
    embeddings: List[List[float]]
) -> List[DocumentChunk]:
    """
    Bulk insert chunks with embeddings.
    
    Args:
        db: SQLAlchemy session
        document_id: Parent document ID
        chunks: List of Chunk objects from chunking.py
        embeddings: List of embedding vectors (parallel to chunks)
        
    Returns:
        List of created DocumentChunk records
        
    Raises:
        ValueError: If chunks and embeddings length mismatch
    """
    if len(chunks) != len(embeddings):
        raise ValueError(
            f"Chunks count ({len(chunks)}) must match embeddings count ({len(embeddings)})"
        )
    
    logger.info(f"Bulk inserting {len(chunks)} chunks for document {document_id}")
    
    chunk_records = []
    
    for chunk, embedding in zip(chunks, embeddings):
        record = DocumentChunk(
            document_id=document_id,
            text=chunk.text,
            chunk_index=chunk.chunk_index,
            page_num=chunk.page_num,
            char_start=chunk.char_start,
            char_end=chunk.char_end,
            embedding=embedding,
            section_title=chunk.section_title,
            token_count=chunk.token_count,
        )
        chunk_records.append(record)
    
    # Bulk insert
    db.bulk_save_objects(chunk_records, return_defaults=True)
    db.commit()
    
    logger.info(f"Successfully inserted {len(chunk_records)} chunks")
    return chunk_records


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


def delete_by_document(db: Session, document_id: int) -> int:
    """
    Delete all chunks for a document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Number of chunks deleted
    """
    result = db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    db.commit()
    
    deleted_count = result.rowcount
    logger.info(f"Deleted {deleted_count} chunks for document {document_id}")
    return deleted_count


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


def search_similar(
    db: Session,
    query_embedding: List[float],
    limit: int = 5,
    document_id: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Find similar chunks using cosine similarity (pgvector).
    
    Args:
        db: SQLAlchemy session
        query_embedding: Query embedding vector
        limit: Number of results to return
        document_id: Optional document ID to filter by
        
    Returns:
        List of {chunk, distance} dicts
    """
    query = db.query(DocumentChunk)
    
    if document_id:
        query = query.filter(DocumentChunk.document_id == document_id)
    
    chunks = query.order_by(
        DocumentChunk.embedding.cosine_distance(query_embedding)
    ).limit(limit).all()
    
    results = []
    for chunk in chunks:
        results.append({
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "text": chunk.text,
            "section_title": chunk.section_title,
            "page_num": chunk.page_num,
            "metadata": chunk.metadata
        })
    
    return results


def update_embedding(db: Session, chunk_id: int, embedding: List[float]) -> bool:
    """
    Update embedding for a single chunk.
    
    Args:
        db: SQLAlchemy session
        chunk_id: Chunk ID
        embedding: New embedding vector
        
    Returns:
        True if updated, False if chunk not found
    """
    chunk = get_by_id(db, chunk_id)
    if not chunk:
        return False
    
    chunk.embedding = embedding
    db.commit()
    
    logger.info(f"Updated embedding for chunk {chunk_id}")
    return True
