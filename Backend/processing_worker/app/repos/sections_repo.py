"""
Repository for document sections - handles CRUD operations.
Manages retrieval, updates, and queries for DocumentSection records.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import delete, func

from shared.models.DocumentSection import DocumentSection

logger = logging.getLogger(__name__)


# ============================================================================
# READ OPERATIONS
# ============================================================================

def get_sections_by_document(
    db: Session,
    document_id: int
) -> List[DocumentSection]:
    """
    Get all sections for a document, ordered by start_chunk_index.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        List of DocumentSection records
    """
    sections = db.query(DocumentSection).filter(
        DocumentSection.document_id == document_id
    ).order_by(DocumentSection.start_chunk_index).all()
    
    logger.info(f"Retrieved {len(sections)} sections for document {document_id}")
    return sections


def get_section_by_id(db: Session, section_id: int) -> Optional[DocumentSection]:
    """
    Get a single section by ID.
    
    Args:
        db: SQLAlchemy session
        section_id: Section ID
        
    Returns:
        DocumentSection or None if not found
    """
    return db.query(DocumentSection).filter(
        DocumentSection.id == section_id
    ).first()


def get_section_by_title(
    db: Session,
    document_id: int,
    section_title: str
) -> Optional[DocumentSection]:
    """
    Find a section by document ID and section title.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        section_title: Section title to search for
        
    Returns:
        DocumentSection or None if not found
    """
    return db.query(DocumentSection).filter(
        DocumentSection.document_id == document_id,
        DocumentSection.section_title == section_title
    ).first()


def count_sections(db: Session, document_id: int) -> int:
    """
    Count sections for a document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Section count
    """
    count = db.query(DocumentSection).filter(
        DocumentSection.document_id == document_id
    ).count()
    return count


# ============================================================================
# UPDATE OPERATIONS
# ============================================================================

def update_summary(
    db: Session,
    section_id: int,
    summary: str,
    model_name: Optional[str] = None,
    token_count: Optional[int] = None
) -> bool:
    """
    Save generated summary to a section.
    
    Args:
        db: SQLAlchemy session
        section_id: Section ID
        summary: Generated summary text
        model_name: LLM model used (e.g., "gemini-1.5-pro")
        token_count: Number of tokens in summary
        
    Returns:
        True if updated, False if section not found
    """
    section = get_section_by_id(db, section_id)
    if not section:
        logger.warning(f"Section {section_id} not found for summary update")
        return False
    
    section.summary = summary
    section.summary_generated_at = datetime.utcnow()
    section.summary_model = model_name
    section.summary_token_count = token_count
    
    db.commit()
    db.refresh(section)
    
    logger.info(
        f"Updated summary for section {section_id} ('{section.section_title}') "
        f"using model {model_name}"
    )
    return True


def clear_summary(db: Session, section_id: int) -> bool:
    """
    Remove cached summary from a section (set to NULL).
    Useful for forcing regeneration.
    
    Args:
        db: SQLAlchemy session
        section_id: Section ID
        
    Returns:
        True if cleared, False if section not found
    """
    section = get_section_by_id(db, section_id)
    if not section:
        logger.warning(f"Section {section_id} not found for summary clear")
        return False
    
    section.summary = None
    section.summary_generated_at = None
    section.summary_model = None
    section.summary_token_count = None
    
    db.commit()
    
    logger.info(f"Cleared summary for section {section_id} ('{section.section_title}')")
    return True


# ============================================================================
# QUERY OPERATIONS
# ============================================================================

def get_sections_without_summary(
    db: Session,
    document_id: int
) -> List[DocumentSection]:
    """
    Find sections that don't have summaries yet.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        List of DocumentSection records without summaries
    """
    sections = db.query(DocumentSection).filter(
        DocumentSection.document_id == document_id,
        DocumentSection.summary.is_(None)
    ).order_by(DocumentSection.start_chunk_index).all()
    
    logger.info(
        f"Found {len(sections)} sections without summaries for document {document_id}"
    )
    return sections


def get_large_sections(
    db: Session,
    document_id: int,
    threshold: int = 50
) -> List[DocumentSection]:
    """
    Find sections with chunk count above threshold.
    Useful for identifying sections that need hierarchical summarization.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        threshold: Minimum chunk count (default: 50)
        
    Returns:
        List of DocumentSection records with chunk_count > threshold
    """
    sections = db.query(DocumentSection).filter(
        DocumentSection.document_id == document_id,
        DocumentSection.chunk_count > threshold
    ).order_by(DocumentSection.chunk_count.desc()).all()
    
    logger.info(
        f"Found {len(sections)} large sections (>{threshold} chunks) "
        f"for document {document_id}"
    )
    return sections


def get_section_statistics(db: Session, document_id: int) -> Dict[str, Any]:
    """
    Get statistics about sections for a document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Dictionary with statistics
    """
    stats = db.query(
        func.count(DocumentSection.id).label('total_sections'),
        func.sum(DocumentSection.chunk_count).label('total_chunks'),
        func.avg(DocumentSection.chunk_count).label('avg_chunks_per_section'),
        func.max(DocumentSection.chunk_count).label('max_chunks'),
        func.min(DocumentSection.chunk_count).label('min_chunks'),
        func.count(DocumentSection.summary).label('sections_with_summary')
    ).filter(
        DocumentSection.document_id == document_id
    ).first()
    
    return {
        'total_sections': stats.total_sections or 0,
        'total_chunks': stats.total_chunks or 0,
        'avg_chunks_per_section': float(stats.avg_chunks_per_section or 0),
        'max_chunks': stats.max_chunks or 0,
        'min_chunks': stats.min_chunks or 0,
        'sections_with_summary': stats.sections_with_summary or 0,
        'sections_without_summary': (stats.total_sections or 0) - (stats.sections_with_summary or 0)
    }


# ============================================================================
# DELETE OPERATIONS
# ============================================================================

def delete_by_document(db: Session, document_id: int) -> int:
    """
    Delete all sections for a document.
    Note: This is usually handled by CASCADE delete from Document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Number of sections deleted
    """
    result = db.execute(
        delete(DocumentSection).where(DocumentSection.document_id == document_id)
    )
    db.commit()
    
    deleted_count = result.rowcount
    logger.info(f"Deleted {deleted_count} sections for document {document_id}")
    return deleted_count


def delete_by_id(db: Session, section_id: int) -> bool:
    """
    Delete a single section by ID.
    
    Args:
        db: SQLAlchemy session
        section_id: Section ID
        
    Returns:
        True if deleted, False if not found
    """
    result = db.execute(
        delete(DocumentSection).where(DocumentSection.id == section_id)
    )
    db.commit()
    
    if result.rowcount > 0:
        logger.info(f"Deleted section {section_id}")
        return True
    else:
        logger.warning(f"Section {section_id} not found for deletion")
        return False
