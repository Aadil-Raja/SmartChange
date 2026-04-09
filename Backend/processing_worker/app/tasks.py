"""
RQ Tasks - Entry point for background job processing.
Now delegates to the full pipeline orchestrator.
"""

import logging
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from shared.models import Document, DocStatus, Quiz, QuizStatus, DocumentProcessingAudit, ProcessingStatus, ProcessingStage
from shared.repos import audit_repo
from pipeline.run_document import process_document_task
from pipeline.quiz_generation import generate_quiz_task, generate_prompt_quiz_task
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
        
        # Delete any existing chunks to prevent duplicates
        from repos import chunks_repo
        existing_chunks = chunks_repo.delete_by_document(db, document_id)
        if existing_chunks > 0:
            logger.info(f"Deleted {existing_chunks} existing chunks before reprocessing")
        
        # Update audit - worker started processing
        audit_repo.update_stage(
            db,
            document_id=document_id,
            current_stage=ProcessingStage.LOADING,
            started_at=datetime.now()
        )
        audit_repo.update_status(db, document_id=document_id, status=ProcessingStatus.PROCESSING)
        
        # Run the full pipeline
        from pipeline.embeddings import EmbeddingConfig
        embedding_config = EmbeddingConfig(
            model_name=settings.embedding_model,
            batch_size=settings.embedding_batch_size,
            max_retries=settings.embedding_max_retries,
            dimension=settings.embedding_dimension
        )
        
        result = process_document_task(
            document_id=document_id,
            db_session=db,
            google_api_key=settings.google_api_key,
            embedding_config=embedding_config,
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



def generate_quiz(quiz_id: int, document_id: int, num_questions: int) -> dict:
    """
    Generate quiz questions from document chunks using Gemini LLM.
    
    Pipeline steps:
    1. Fetch document chunks from database
    2. Smart chunk selection
    3. Call Gemini to generate MCQ questions
    4. Parse and save questions to database
    5. Update quiz status to DRAFT
    
    Args:
        quiz_id: ID of quiz to populate
        document_id: ID of document to generate from
        num_questions: Number of questions to generate
        
    Returns:
        Dict with generation results for RQ job.result
    """
    logger.info(f"=" * 60)
    logger.info(f"Starting generate_quiz task for quiz_id: {quiz_id}")
    logger.info(f"Document ID: {document_id}, Questions: {num_questions}")
    logger.info(f"=" * 60)
    
    db = _SessionLocal()
    job_id = None
    
    try:
        # Get current RQ job ID
        from rq import get_current_job
        current_job = get_current_job()
        if current_job:
            job_id = current_job.id
            logger.info(f"RQ Job ID: {job_id}")
        
        # Verify quiz exists
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            logger.error(f"Quiz {quiz_id} not found")
            return {"success": False, "error": "quiz_not_found"}
        
        logger.info(f"Generating quiz: {quiz.title}")
        
        # Create audit record
        from shared.repos import quiz_audit_repo
        from shared.models import QuizGenerationStatus
        
        if job_id:
            audit = quiz_audit_repo.create_audit(
                db,
                quiz_id=quiz_id,
                document_id=document_id,
                job_id=job_id,
                num_questions_requested=num_questions
            )
            logger.info(f"Created audit record: {audit.id}")
            
            # Update status to GENERATING
            quiz_audit_repo.update_status(db, job_id, QuizGenerationStatus.GENERATING)
        
        # Run the quiz generation pipeline
        # Get API key based on provider using shared utility
        from shared.llm.utils import get_llm_api_key
        
        try:
            api_key = get_llm_api_key(
                llm_provider=settings.llm_provider,
                google_api_key=settings.google_api_key,
                openai_api_key=settings.openai_api_key
            )
            logger.info(f"Using {settings.llm_provider} provider with model {settings.llm_model}")
        except ValueError as e:
            logger.error(f"LLM configuration error: {e}")
            return {"success": False, "error": str(e)}
        
        result = generate_quiz_task(
            quiz_id=quiz_id,
            document_id=document_id,
            num_questions=num_questions,
            db_session=db,
            llm_provider=settings.llm_provider,
            llm_model=settings.llm_model,
            api_key=api_key,
            job_id=job_id
        )
        
        # Update quiz status and audit based on result
        if result["success"]:
            logger.info(f"✓ Quiz generation completed successfully")
            logger.info(f"  - Questions created: {result['questions_created']}")
            logger.info(f"  - Metadata: {result['metadata']}")
            
            # Update audit to COMPLETED
            if job_id:
                quiz_audit_repo.update_status(db, job_id, QuizGenerationStatus.COMPLETED)
        else:
            logger.error(f"✗ Quiz generation failed: {result['error']}")
            
            # Update audit with error
            if job_id:
                quiz_audit_repo.update_error(db, job_id, result['error'], result.get('metadata', {}).get('error_stage'))
            
            # Mark quiz as DRAFT (failed generation)
            from shared.repos import quiz_repo
            try:
                quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            except Exception as update_error:
                logger.error(f"Failed to update quiz status: {update_error}")
        
        logger.info(f"=" * 60)
        return result
        
    except Exception as e:
        logger.error(f"Unexpected error in generate_quiz task: {e}", exc_info=True)
        
        # Try to mark quiz as DRAFT (failed)
        try:
            from shared.repos import quiz_repo
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        except Exception:
            pass
        
        return {
            "success": False,
            "error": str(e),
            "quiz_id": quiz_id,
            "questions_created": 0
        }
        
    finally:
        db.close()


def generate_quiz_from_prompt(quiz_id: int, prompt_text: str, num_questions: int) -> dict:
    """
    Generate quiz questions from a free-text prompt using LLM.

    Args:
        quiz_id: ID of quiz to populate
        prompt_text: Admin-written prompt (max 500 chars enforced in pipeline)
        num_questions: Number of questions to generate (1-20)

    Returns:
        Dict with generation results
    """
    logger.info(f"Starting generate_quiz_from_prompt task for quiz_id={quiz_id}")

    db = _SessionLocal()
    try:
        quiz = db.query(Quiz).filter(Quiz.id == quiz_id).first()
        if not quiz:
            logger.error(f"Quiz {quiz_id} not found")
            return {"success": False, "error": "quiz_not_found"}

        from shared.llm.utils import get_llm_api_key
        api_key = get_llm_api_key(
            llm_provider=settings.llm_provider,
            google_api_key=settings.google_api_key,
            openai_api_key=settings.openai_api_key,
        )

        result = generate_prompt_quiz_task(
            quiz_id=quiz_id,
            prompt_text=prompt_text,
            num_questions=num_questions,
            db_session=db,
            llm_provider=settings.llm_provider,
            llm_model=settings.llm_model,
            api_key=api_key,
        )

        if result["success"]:
            logger.info(f"✓ Prompt quiz generation done. Questions: {result['questions_created']}")
        else:
            logger.error(f"✗ Prompt quiz generation failed: {result['error']}")

        return result

    except Exception as e:
        logger.error(f"Unexpected error in generate_quiz_from_prompt: {e}", exc_info=True)
        try:
            from shared.repos import quiz_repo
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        except Exception:
            pass
        return {"success": False, "error": str(e), "quiz_id": quiz_id, "questions_created": 0}
    finally:
        db.close()


def check_deadline_notifications(user_id: int) -> dict:
    """
    Check a user's enrolled courses for upcoming deadlines and create
    system notifications for 7-day and 15-day thresholds.
    Skips if a notification for the same course+threshold was already sent today.

    Args:
        user_id: ID of the user who just logged in

    Returns:
        Dict with count of notifications created
    """
    from datetime import timedelta, date, timezone as dt_timezone
    from sqlalchemy import and_
    from shared.models.course_enrollment import CourseEnrollment
    from shared.models.course import Course
    from shared.models.notification import Notification, NotificationType
    from shared.repos import notification_repo

    THRESHOLDS = [7, 15]  # days

    db = _SessionLocal()
    created = 0

    try:
        # Fetch all active (not completed) enrollments for this user
        enrollments = (
            db.query(CourseEnrollment, Course)
            .join(Course, Course.id == CourseEnrollment.course_id)
            .filter(
                and_(
                    CourseEnrollment.user_id == user_id,
                    CourseEnrollment.completed_at.is_(None),
                    Course.deadline_weeks.isnot(None),
                )
            )
            .all()
        )

        today = date.today()
        today_start = datetime.now(dt_timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

        for enrollment, course in enrollments:
            deadline_at = enrollment.enrolled_at + timedelta(weeks=course.deadline_weeks)
            days_remaining = (deadline_at.date() - today).days

            for threshold in THRESHOLDS:
                # Only fire when days_remaining is within [threshold-1, threshold]
                if not (threshold - 1 <= days_remaining <= threshold):
                    continue

                # Deduplicate: skip if we already sent this threshold notification today
                already_sent = (
                    db.query(Notification)
                    .filter(
                        and_(
                            Notification.user_id == user_id,
                            Notification.related_course_id == course.id,
                            Notification.type == NotificationType.SYSTEM,
                            Notification.title == f"Deadline in {threshold} days",
                            Notification.created_at >= today_start,
                        )
                    )
                    .first()
                )

                if already_sent:
                    continue

                notification_repo.create_notification(
                    db,
                    user_id=user_id,
                    type=NotificationType.SYSTEM,
                    title=f"Deadline in {threshold} days",
                    message=(
                        f'Your deadline for "{course.title}" is approaching. '
                        f"You have {days_remaining} day{'s' if days_remaining != 1 else ''} left to complete it."
                    ),
                    related_course_id=course.id,
                )
                created += 1
                logger.info(
                    f"[deadline_notify] user={user_id} course={course.id} threshold={threshold}d"
                )

        return {"ok": True, "notifications_created": created}

    except Exception as e:
        logger.error(f"check_deadline_notifications failed for user {user_id}: {e}", exc_info=True)
        return {"ok": False, "error": str(e)}

    finally:
        db.close()
