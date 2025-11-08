"""
Repository for documents - handles CRUD operations.
Manages document records and status updates.
Consolidated from processing_worker and management services.
"""

import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from shared.models.Document import Document, DocStatus
from shared.models.user import User

logger = logging.getLogger(__name__)


def create_document(
    db: Session,
    *,
    title: str,
    original_filename: str,
    storage_key: str,
    mime_type: str,
    size_bytes: int,
    uploaded_by: int,
    status: DocStatus = DocStatus.STORED,
) -> Document:
    """
    Insert a single Document row after the file has been safely stored.
    Default status is STORED; adjust if you want PENDING→STORED flow.
    
    Args:
        db: SQLAlchemy session
        title: Document title
        original_filename: Original filename
        storage_key: Storage location key
        mime_type: MIME type
        size_bytes: File size in bytes
        uploaded_by: User ID who uploaded
        status: Initial status (default: STORED)
        
    Returns:
        Created Document instance
    """
    doc = Document(
        title=title,
        original_filename=original_filename,
        storage_key=storage_key,
        mime_type=mime_type,
        size_bytes=size_bytes,
        status=status,
        uploaded_by=uploaded_by,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    
    logger.info(f"Created document {doc.id}: {title}")
    return doc


def get_by_id(db: Session, document_id: int) -> Optional[Document]:
    """
    Get document by ID.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Document or None if not found
    """
    return db.query(Document).filter(Document.id == document_id).first()


def get_document(db: Session, document_id: int) -> Optional[Document]:
    """
    Alias for get_by_id for backward compatibility.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Document or None if not found
    """
    return get_by_id(db, document_id)


def get_by_status(db: Session, status: DocStatus, limit: int = 100) -> List[Document]:
    """
    Get documents by status.
    
    Args:
        db: SQLAlchemy session
        status: Document status
        limit: Maximum number of documents to return
        
    Returns:
        List of documents
    """
    return db.query(Document).filter(
        Document.status == status
    ).limit(limit).all()


def list_documents(db: Session):
    """
    Return latest documents (newest first) joined with user email.
    
    Args:
        db: SQLAlchemy session
        
    Returns:
        List of tuples (Document, uploader_email)
    """
    query = (
        db.query(
            Document,
            User.email.label("uploader_email")
        )
        .join(User, User.id == Document.uploaded_by)
        .order_by(desc(Document.created_at), desc(Document.id))
    )
    
    return query.all()


def list_processed_documents(db: Session) -> dict:
    """
    Return all processed documents (id + title only).
    
    Args:
        db: SQLAlchemy session
        
    Returns:
        Dictionary with documents list
    """
    docs = (
        db.query(Document)
        .filter(Document.status == DocStatus.PROCESSED)
        .order_by(desc(Document.created_at))
        .all()
    )
    return {"documents": [{"id": d.id, "title": d.title} for d in docs]}


def update_status(db: Session, document_id: int, status: DocStatus) -> bool:
    """
    Update document status.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        status: New status
        
    Returns:
        True if updated, False if document not found
    """
    doc = get_by_id(db, document_id)
    if not doc:
        logger.warning(f"Document {document_id} not found for status update")
        return False
    
    old_status = doc.status
    doc.status = status
    doc.updated_at = func.now()
    db.commit()
    
    logger.info(f"Document {document_id} status updated: {old_status} -> {status}")
    return True


def update(db: Session, document_id: int, **kwargs) -> bool:
    """
    Update document fields.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        **kwargs: Fields to update
        
    Returns:
        True if updated, False if document not found
    """
    doc = get_by_id(db, document_id)
    if not doc:
        return False
    
    for key, value in kwargs.items():
        if hasattr(doc, key):
            setattr(doc, key, value)
    
    db.commit()
    logger.info(f"Document {document_id} updated: {list(kwargs.keys())}")
    return True


def delete(db: Session, document_id: int) -> bool:
    """
    Delete document (cascades to chunks).
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        True if deleted, False if not found
    """
    doc = get_by_id(db, document_id)
    if not doc:
        return False
    
    db.delete(doc)
    db.commit()
    
    logger.info(f"Document {document_id} deleted")
    return True


def get_document_info(db: Session, document_id: int) -> Optional[dict]:
    """
    Get document metadata as a dictionary.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        
    Returns:
        Dictionary with document info or None if not found
    """
    doc = get_by_id(db, document_id)
    if not doc:
        return None
    
    return {
        "id": doc.id,
        "title": doc.title,
        "original_filename": doc.original_filename,
        "mime_type": doc.mime_type,
        "status": doc.status,
        "size_bytes": doc.size_bytes,
        "created_at": doc.created_at
    }


def attach_cloudinary_fields(
    db: Session,
    *,
    document_id: int,
    url: str,
    public_id: Optional[str],
    thumbnail_url: Optional[str] = None
) -> Optional[Document]:
    """
    Attach Cloudinary URL, public_id, and thumbnail URL to a document.
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        url: Cloudinary URL
        public_id: Cloudinary public ID
        thumbnail_url: Cloudinary thumbnail URL (optional)
        
    Returns:
        Updated Document or None if not found
    """
    doc = get_by_id(db, document_id)
    if not doc:
        return None
    
    doc.cloudinary_url = url
    doc.cloudinary_public_id = public_id
    if thumbnail_url: 
        doc.cloudinary_thumbnail_url = thumbnail_url  
    db.commit()
    db.refresh(doc)
    
    logger.info(f"Attached Cloudinary fields to document {document_id}")
    return doc


# 🆕 NEW FUNCTION: Update main topics
def update_main_topics(
    db: Session,
    *,
    document_id: int,
    main_topics: dict
) -> Optional[Document]:
    """
    Update the main topics for a document.
    Topics are stored as key-value pairs: {topic_name: description}
    
    Args:
        db: SQLAlchemy session
        document_id: Document ID
        main_topics: Dictionary of {topic_name: description/sub-topics}
        
    Returns:
        Updated Document or None if not found
    """
    doc = get_by_id(db, document_id)
    if not doc:
        logger.warning(f"Document {document_id} not found for main topics update")
        return None
    
    doc.main_topics = main_topics
    doc.updated_at = func.now()
    db.commit()
    db.refresh(doc)
    
    logger.info(f"Updated main topics for document {document_id}: {list(main_topics.keys())}")
    return doc


# 🆕 NEW FUNCTION: Get all unique main topics with descriptions
def get_all_main_topics(db: Session,    *,
    document_id: int) -> dict:
    """
    Get all unique main topics across all documents with their descriptions.
    If the same topic appears in multiple documents, uses the first occurrence.
    
    Args:
        db: SQLAlchemy session
        
    Returns:
        Dictionary of {topic_name: description}, sorted by topic name
    """
    # Query all documents that have main_topics
    doc = get_by_id(db, document_id)
    
    # Collect all unique topics with their descriptions
    topics_dict = {}
    if doc.main_topics and isinstance(doc.main_topics, dict):
            for topic_name, description in doc.main_topics.items():
          
                if topic_name not in topics_dict:
                    topics_dict[topic_name] = description
    
    # Return sorted dictionary by topic name
    sorted_topics = dict(sorted(topics_dict.items()))
    
    logger.info(f"Retrieved {len(sorted_topics)} unique main topics")
    return sorted_topics