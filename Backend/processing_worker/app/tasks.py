"""
RQ Tasks - Entry point for background job processing.
Now delegates to the full pipeline orchestrator.
"""

import os
import logging

# Load .env early
try:
    from dotenv import load_dotenv, find_dotenv
    load_dotenv(find_dotenv())
except Exception:
    pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.models.Document import Document, DocStatus
from pipeline.run_document import process_document_task

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Set it in .env or the environment.")

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY is not set. Set it in .env or the environment.")

_engine = create_engine(DATABASE_URL, pool_pre_ping=True, future=True)
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
        
        # Run the full pipeline
        result = process_document_task(
            document_id=document_id,
            db_session=db,
            google_api_key=GOOGLE_API_KEY,
        )
        
        # Log results
        if result["success"]:
            logger.info(f"✓ Pipeline completed successfully")
            logger.info(f"  - Chunks created: {result['chunks_created']}")
            logger.info(f"  - Metadata: {result['metadata']}")
        else:
            logger.error(f"✗ Pipeline failed: {result['error']}")
        
        logger.info(f"=" * 60)
        return result
        
    except Exception as e:
        logger.error(f"Unexpected error in process_document task: {e}", exc_info=True)
        
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
    from app.repos.chunks_repo import get_chunks_repo
    
    db = _SessionLocal()
    
    try:
        # Delete existing chunks
        chunks_repo = get_chunks_repo(db)
        deleted = chunks_repo.delete_by_document(document_id)
        logger.info(f"Deleted {deleted} existing chunks for document {document_id}")
        
        # Run pipeline again
        return process_document(document_id)
        
    finally:
        db.close()


