"""
Repository for documents - handles CRUD operations.
Manages document records and status updates.
"""

import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from shared.models.Document import Document, DocStatus

logger = logging.getLogger(__name__)


class DocumentsRepository:
    """Repository for managing documents."""
    
    def __init__(self, db: Session):
        """
        Initialize repository with database session.
        
        Args:
            db: SQLAlchemy session
        """
        self.db = db
    
    def get_by_id(self, document_id: int) -> Optional[Document]:
        """
        Get document by ID.
        
        Args:
            document_id: Document ID
            
        Returns:
            Document or None if not found
        """
        return self.db.query(Document).filter(Document.id == document_id).first()
    
    def get_by_status(self, status: DocStatus, limit: int = 100) -> List[Document]:
        """
        Get documents by status.
        
        Args:
            status: Document status
            limit: Maximum number of documents to return
            
        Returns:
            List of documents
        """
        return self.db.query(Document).filter(
            Document.status == status
        ).limit(limit).all()
    
    def update_status(self, document_id: int, status: DocStatus) -> bool:
        """
        Update document status.
        
        Args:
            document_id: Document ID
            status: New status
            
        Returns:
            True if updated, False if document not found
        """
        doc = self.get_by_id(document_id)
        if not doc:
            logger.warning(f"Document {document_id} not found for status update")
            return False
        
        old_status = doc.status
        doc.status = status
        self.db.commit()
        
        logger.info(f"Document {document_id} status updated: {old_status} -> {status}")
        return True
    
    def update(self, document_id: int, **kwargs) -> bool:
        """
        Update document fields.
        
        Args:
            document_id: Document ID
            **kwargs: Fields to update
            
        Returns:
            True if updated, False if document not found
        """
        doc = self.get_by_id(document_id)
        if not doc:
            return False
        
        for key, value in kwargs.items():
            if hasattr(doc, key):
                setattr(doc, key, value)
        
        self.db.commit()
        logger.info(f"Document {document_id} updated: {list(kwargs.keys())}")
        return True
    
    def delete(self, document_id: int) -> bool:
        """
        Delete document (cascades to chunks).
        
        Args:
            document_id: Document ID
            
        Returns:
            True if deleted, False if not found
        """
        doc = self.get_by_id(document_id)
        if not doc:
            return False
        
        self.db.delete(doc)
        self.db.commit()
        
        logger.info(f"Document {document_id} deleted")
        return True