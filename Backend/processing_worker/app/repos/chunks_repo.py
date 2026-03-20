"""
Repository for document chunks - handles CRUD operations.
Manages bulk insert, retrieval, and deletion of chunks with embeddings.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import delete

from shared.models.Document import DocumentChunk
from shared.models.DocumentSection import DocumentSection

logger = logging.getLogger(__name__)


def bulk_insert(
    db: Session,
    document_id: int,
    chunks: List[Any],
    embeddings: List[List[float]]
) -> List[DocumentChunk]:
    """
    Bulk insert chunks with embeddings and create DocumentSection entries.
    
    This function performs streaming section detection: as chunks are inserted,
    it detects when section_title changes and creates DocumentSection records
    with chunk boundaries.
    
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
    section_records = []
    
    # Section tracking variables
    current_section_title = None
    section_start_index = None
    
    for chunk, embedding in zip(chunks, embeddings):
        # Normalize section_title (handle NULL/empty)
        section_title = chunk.section_title if chunk.section_title else "General Content"
        
        # Detect section change
        if section_title != current_section_title:
            # Save previous section (if exists)
            if current_section_title is not None and section_start_index is not None:
                previous_chunk_index = chunk.chunk_index - 1
                chunk_count = previous_chunk_index - section_start_index + 1
                
                section_record = DocumentSection(
                    document_id=document_id,
                    section_title=current_section_title,
                    start_chunk_index=section_start_index,
                    end_chunk_index=previous_chunk_index,
                    chunk_count=chunk_count
                )
                section_records.append(section_record)
                
                logger.debug(
                    f"Section '{current_section_title}': chunks {section_start_index}-{previous_chunk_index} "
                    f"(count={chunk_count})"
                )
            
            # Start tracking new section
            current_section_title = section_title
            section_start_index = chunk.chunk_index
        
        # Create chunk record
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
    
    # Save the last section (if any chunks were processed)
    if current_section_title is not None and section_start_index is not None and chunks:
        last_chunk_index = chunks[-1].chunk_index
        chunk_count = last_chunk_index - section_start_index + 1
        
        section_record = DocumentSection(
            document_id=document_id,
            section_title=current_section_title,
            start_chunk_index=section_start_index,
            end_chunk_index=last_chunk_index,
            chunk_count=chunk_count
        )
        section_records.append(section_record)
        
        logger.debug(
            f"Section '{current_section_title}': chunks {section_start_index}-{last_chunk_index} "
            f"(count={chunk_count})"
        )
    
    # Bulk insert both chunks and sections in single transaction
    db.bulk_save_objects(chunk_records, return_defaults=True)
    db.bulk_save_objects(section_records, return_defaults=True)
    db.commit()
    
    logger.info(
        f"Successfully inserted {len(chunk_records)} chunks and {len(section_records)} sections "
        f"for document {document_id}"
    )
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
    Note: DocumentSection records are automatically deleted via CASCADE.
    
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
