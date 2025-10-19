"""
Document processing orchestrator - ties all pipeline steps together.
Main entry point for processing a single document through the full pipeline.
"""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

# Pipeline modules
from .loaders import extract_text
from .preprocess import preprocess_document
from .chunking import chunk_document, ChunkingConfig
from .embeddings import generate_embeddings, EmbeddingConfig

# Repositories
from repos import chunks_repo
from shared.repos import documents_repo as docs_repo

# Models
from shared.models.Document import DocStatus
from shared.models.Audit import ProcessingStage

# Audit repository
from shared.repos import audit_repo

logger = logging.getLogger(__name__)


class PipelineConfig:
    """Configuration for the entire pipeline."""
    def __init__(
        self,
        google_api_key: str,
        chunking_config: Optional[ChunkingConfig] = None,
        embedding_config: Optional[EmbeddingConfig] = None,
        generate_summary: bool = False,
    ):
        self.google_api_key = google_api_key
        self.chunking_config = chunking_config or ChunkingConfig()
        self.embedding_config = embedding_config or EmbeddingConfig()
        self.generate_summary = generate_summary


class PipelineResult:
    """Result from document pipeline execution."""
    def __init__(
        self,
        success: bool,
        document_id: int,
        chunks_created: int = 0,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.success = success
        self.document_id = document_id
        self.chunks_created = chunks_created
        self.error = error
        self.metadata = metadata or {}


def run_document_pipeline(
    document_id: int,
    db: Session,
    config: PipelineConfig
) -> PipelineResult:
    """
    Execute the full document processing pipeline.
    
    Steps:
    1. Load document from storage
    2. Extract text (loaders)
    3. Preprocess text (clean, segment)
    4. Chunk text
    5. Generate embeddings
    6. Store chunks + embeddings in database
    7. Update document status
    
    Args:
        document_id: ID of document to process
        db: Database session
        config: PipelineConfig with API keys and settings
        
    Returns:
        PipelineResult with success status and metadata
    """
    logger.info(f"Starting pipeline for document {document_id}")
    
    # Initialize current stage
    current_stage = ProcessingStage.LOADING
    
    try:
        # Step 0: Get document and mark as PROCESSING
        doc = docs_repo.get_by_id(db, document_id)
        if not doc:
            return PipelineResult(
                success=False,
                document_id=document_id,
                error="Document not found"
            )
        
        docs_repo.update_status(db, document_id, DocStatus.PROCESSING)
        logger.info(f"Document {document_id} marked as PROCESSING")
        
        # Step 1: Load document text
        current_stage = ProcessingStage.LOADING
        audit_repo.update_stage(db, document_id=document_id, current_stage=current_stage)
        logger.info("Step 1: Loading document...")
        loader_result = extract_text(doc.storage_key, doc.mime_type)
        logger.info(f"Loaded {loader_result.total_pages} pages")
        
        # Step 2: Preprocess
        current_stage = ProcessingStage.PREPROCESSING
        audit_repo.update_stage(db, document_id=document_id, current_stage=current_stage)
        logger.info("Step 2: Preprocessing...")
        preprocess_result = preprocess_document(loader_result)
        logger.info(f"Created {len(preprocess_result.segments)} segments")
        
        # Step 3: Chunk
        current_stage = ProcessingStage.CHUNKING
        audit_repo.update_stage(db, document_id=document_id, current_stage=current_stage)
        logger.info("Step 3: Chunking...")
        chunks = chunk_document(
            preprocess_result,
            document_id,
            config.chunking_config
        )
        logger.info(f"Created {len(chunks)} chunks")
        
        if not chunks:
            logger.warning("No chunks created - document may be empty")
            docs_repo.update_status(db, document_id, DocStatus.PROCESSED)
            audit_repo.update_stage(db, document_id=document_id, current_stage=ProcessingStage.COMPLETED)
            return PipelineResult(
                success=True,
                document_id=document_id,
                chunks_created=0,
                metadata={"warning": "No chunks created"}
            )
        
        # Step 4: Generate embeddings
        current_stage = ProcessingStage.EMBEDDING
        audit_repo.update_stage(db, document_id=document_id, current_stage=current_stage)
        logger.info("Step 4: Generating embeddings...")
        embeddings = generate_embeddings(
            chunks,
            config.google_api_key,
            config.embedding_config
        )
        logger.info(f"Generated {len(embeddings)} embeddings")
        
        # Step 5: Store chunks + embeddings
        current_stage = ProcessingStage.STORING
        audit_repo.update_stage(db, document_id=document_id, current_stage=current_stage)
        logger.info("Step 5: Storing chunks in database...")
        chunk_records = chunks_repo.bulk_insert(db, document_id, chunks, embeddings)
        logger.info(f"Stored {len(chunk_records)} chunks")
        
        # Step 6: Optional - Generate summary (future feature)
        if config.generate_summary:
            logger.info("Step 6: Generating summary...")
            # TODO: Implement summarization
            pass
        
        # Step 7: Mark document as PROCESSED and update to COMPLETED stage
        docs_repo.update_status(db, document_id, DocStatus.PROCESSED)
        audit_repo.update_stage(db, document_id=document_id, current_stage=ProcessingStage.COMPLETED)
        logger.info(f"Document {document_id} marked as PROCESSED")
        
        # Return success
        return PipelineResult(
            success=True,
            document_id=document_id,
            chunks_created=len(chunk_records),
            metadata={
                "pages": loader_result.total_pages,
                "segments": len(preprocess_result.segments),
                "chunks": len(chunks),
                "has_toc": preprocess_result.has_toc,
            }
        )
        
    except Exception as e:
        logger.error(f"Pipeline failed for document {document_id}: {e}", exc_info=True)
        
        # Cleanup any partial chunks that may have been stored
        try:
            deleted_count = chunks_repo.delete_by_document(db, document_id)
            if deleted_count > 0:
                logger.info(f"Cleaned up {deleted_count} partial chunks for failed document {document_id}")
        except Exception as cleanup_error:
            logger.error(f"Failed to cleanup chunks: {cleanup_error}")
        
        # Mark document as FAILED
        try:
            docs_repo.update_status(db, document_id, DocStatus.FAILED)
            logger.info(f"Document {document_id} marked as FAILED")
        except Exception as update_error:
            logger.error(f"Failed to update status: {update_error}")
        
        # Return failure with error_stage
        return PipelineResult(
            success=False,
            document_id=document_id,
            error=str(e),
            metadata={"error_stage": current_stage.value}
        )


def process_document_task(
    document_id: int,
    db_session: Session,
    google_api_key: str,
    **kwargs
) -> Dict[str, Any]:
    """
    Task wrapper for RQ worker integration.
    
    Args:
        document_id: Document ID to process
        db_session: Database session
        google_api_key: Google API key
        **kwargs: Additional config options
        
    Returns:
        Dict with task result
    """
    config = PipelineConfig(
        google_api_key=google_api_key,
        chunking_config=kwargs.get('chunking_config'),
        embedding_config=kwargs.get('embedding_config'),
        generate_summary=kwargs.get('generate_summary', False),
    )
    
    result = run_document_pipeline(document_id, db_session, config)
    
    return {
        "success": result.success,
        "document_id": result.document_id,
        "chunks_created": result.chunks_created,
        "error": result.error,
        "metadata": result.metadata,
    }