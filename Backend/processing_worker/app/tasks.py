"""
RQ Tasks - Entry point for background job processing.
Now delegates to the full pipeline orchestrator.
"""

import logging
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.models.Document import Document, DocStatus
from shared.models.Audit import ProcessingStatus, ProcessingStage
from shared.repos import audit_repo
from pipeline.run_document import process_document_task
from core.config import get_settings

# Setup logging
settings = get_settings()
logging.basicConfig(
    level=settings.log_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database setup
_engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
_SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def process_document(document_id: int) -> dict:
    """
    Main task for processing a document through the complete pipeline.
    
    Pipeline steps:
    1. Load document text (PDF/DOCX/TXT/Image)
    2. Preprocess (clean, detect structure)
    3. Chunk into embedable segments
    4. Generate embeddings with Google AI
    5. Store chunks + embeddings in database
    6. Mark document as PROCESSED
    
    Args:
        document_id: ID of document to process
        
    Returns:
        Dict with processing results for RQ job.result
    """
    logger.info(f"=" * 60)
    logger.info(f"Starting process_document task for ID: {document_id}")
    logger.info(f"=" * 60)
    
    db = _SessionLocal()
    
    try:
        # Verify document exists
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            logger.error(f"Document {document_id} not found")
            return {"ok": False, "error": "document_not_found"}
        
        logger.info(f"Processing: {doc.title} ({doc.mime_type})")
        logger.info(f"Storage: {doc.storage_key}")
        
        # Update audit - worker started processing
        audit_repo.update_stage(
            db,
            document_id=document_id,
            current_stage=ProcessingStage.LOADING,
            started_at=datetime.now()
        )
        audit_repo.update_status(db, document_id=document_id, status=ProcessingStatus.PROCESSING)
        
        # Run the full pipeline
        result = process_document_task(
            document_id=document_id,
            db_session=db,
            google_api_key=settings.google_api_key,
        )
        
        # Update audit based on result
        if result["success"]:
            logger.info(f"✓ Pipeline completed successfully")
            logger.info(f"  - Chunks created: {result['chunks_created']}")
            logger.info(f"  - Metadata: {result['metadata']}")
            
            # Update audit record with completion details
            audit_repo.update_complete(
                db,
                document_id=document_id,
                chunks_created=result['chunks_created'],
                pages_processed=result['metadata'].get('pages', 0)
            )
            audit_repo.update_status(db, document_id=document_id, status=ProcessingStatus.COMPLETED)
        else:
            logger.error(f"✗ Pipeline failed: {result['error']}")
            
            # Cleanup any partial chunks that may have been stored
            from repos import chunks_repo
            try:
                deleted_count = chunks_repo.delete_by_document(db, document_id)
                if deleted_count > 0:
                    logger.info(f"Cleaned up {deleted_count} partial chunks for failed document {document_id}")
            except Exception as cleanup_error:
                logger.error(f"Failed to cleanup chunks: {cleanup_error}")
            
            # Update audit record with failure details
            error_stage = result.get('metadata', {}).get('error_stage', 'UNKNOWN')
            audit_repo.update_failed(
                db,
                document_id=document_id,
                error_message=result.get('error', 'Unknown error'),
                error_stage=error_stage
            )
        
        logger.info(f"=" * 60)
        return result
        
    except Exception as e:
        logger.error(f"Unexpected error in process_document task: {e}", exc_info=True)
        
        # Cleanup any partial chunks that may have been stored
        from repos import chunks_repo
        try:
            deleted_count = chunks_repo.delete_by_document(db, document_id)
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} partial chunks after exception for document {document_id}")
        except Exception as cleanup_error:
            logger.error(f"Failed to cleanup chunks: {cleanup_error}")
        
        # Update audit record with exception details
        try:
            audit_repo.update_failed(
                db,
                document_id=document_id,
                error_message=str(e),
                error_stage='UNKNOWN'
            )
        except Exception as audit_error:
            logger.error(f"Failed to update audit record: {audit_error}")
        
        # Try to mark document as FAILED
        try:
            doc = db.query(Document).filter(Document.id == document_id).first()
            if doc:
                doc.status = DocStatus.FAILED
                db.commit()
        except Exception:
            pass
        
        return {
            "ok": False,
            "error": str(e),
            "document_id": document_id
        }
        
    finally:
        db.close()


# Optional: Add more tasks here as needed
def reprocess_document(document_id: int) -> dict:
    """
    Reprocess a document (deletes old chunks and re-runs pipeline).
    
    Args:
        document_id: Document ID
        
    Returns:
        Processing result dict
    """
    from repos import chunks_repo
    
    db = _SessionLocal()
    
    try:
        # Delete existing chunks
        deleted = chunks_repo.delete_by_document(db, document_id)
        logger.info(f"Deleted {deleted} existing chunks for document {document_id}")
        
        # Run pipeline again
        return process_document(document_id)
        
    finally:
        db.close()


# process_document(36)