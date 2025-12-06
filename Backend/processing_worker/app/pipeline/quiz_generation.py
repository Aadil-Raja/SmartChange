"""
Quiz Generation Pipeline - Uses Gemini 2.5 Flash to generate MCQ questions from document chunks
Follows the same pattern as document processing pipeline.
"""

import logging
import json
import random
from typing import List, Dict, Optional, Any
import google.generativeai as genai
from sqlalchemy.orm import Session

from shared.models import DocumentChunk, Quiz, QuizStatus, QuizGenerationStage
from shared.repos import quiz_repo, quiz_audit_repo

logger = logging.getLogger(__name__)

# Configuration constants
MAX_QUESTIONS = 20  # Maximum questions allowed
MIN_CHUNKS = 5  # Minimum chunks to use (if available)
MAX_TOKENS = 50000  # Maximum tokens to send to Gemini


class QuizPipelineConfig:
    """Configuration for quiz generation pipeline."""
    def __init__(
        self,
        google_api_key: str,
        model_name: str = "gemini-2.5-flash",
        max_retries: int = 3,
    ):
        self.google_api_key = google_api_key
        self.model_name = model_name
        self.max_retries = max_retries


class QuizPipelineResult:
    """Result from quiz generation pipeline execution."""
    def __init__(
        self,
        success: bool,
        quiz_id: int,
        questions_created: int = 0,
        error: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        self.success = success
        self.quiz_id = quiz_id
        self.questions_created = questions_created
        self.error = error
        self.metadata = metadata or {}


def select_chunks_for_quiz(
    chunks: List[DocumentChunk],
    num_questions: int
) -> List[DocumentChunk]:
    """
    Select chunks proportionally based on number of questions requested.
    Uses random sampling with token limit safety.
    
    Strategy:
    - More questions = more chunks
    - Random selection for variety
    - Hard token limit for API safety
    - Handles small documents gracefully (uses all available chunks if < MIN_CHUNKS)
    
    Args:
        chunks: All available chunks from document
        num_questions: Number of questions to generate (5-20)
        
    Returns:
        List of selected chunks, sorted by chunk_index
    """
    if not chunks:
        logger.warning("No chunks available for quiz generation")
        return []
    
    total_available = len(chunks)
    
    # Step 1: Calculate proportional chunks needed
    # Formula: chunks_ratio = num_questions / MAX_QUESTIONS
    chunks_ratio = num_questions / MAX_QUESTIONS
    chunks_to_use = int(total_available * chunks_ratio)
    
    # Step 2: Apply minimum, but respect document size
    # If document has fewer chunks than MIN_CHUNKS, use all available
    chunks_to_use = max(min(MIN_CHUNKS, total_available), chunks_to_use)
    chunks_to_use = min(chunks_to_use, total_available)  # Can't use more than available
    
    logger.info(f"Chunk selection: {num_questions} questions → {chunks_ratio:.2%} ratio → {chunks_to_use}/{total_available} chunks")
    
    # Step 3: Random selection for variety
    # If we need all chunks, just use them all (no need for random.sample)
    if chunks_to_use >= total_available:
        selected_chunks = list(chunks)
        logger.info(f"Using all {total_available} available chunks")
    else:
        selected_chunks = random.sample(chunks, chunks_to_use)
    
    # Step 4: Safety - Enforce max token limit
    total_tokens = sum(chunk.token_count or 0 for chunk in selected_chunks)
    
    if total_tokens > MAX_TOKENS:
        logger.warning(f"Token limit exceeded: {total_tokens} > {MAX_TOKENS}, trimming chunks...")
        
        # Remove random chunks until under limit
        # Keep at least 1 chunk (even if document is tiny)
        min_chunks_to_keep = min(MIN_CHUNKS, total_available, 1)
        
        while total_tokens > MAX_TOKENS and len(selected_chunks) > min_chunks_to_keep:
            # Remove a random chunk
            removed_chunk = selected_chunks.pop(random.randint(0, len(selected_chunks) - 1))
            total_tokens -= (removed_chunk.token_count or 0)
        
        logger.info(f"Trimmed to {len(selected_chunks)} chunks, {total_tokens} tokens")
    
    # Step 5: Sort by chunk_index to maintain document flow
    selected_chunks.sort(key=lambda c: c.chunk_index)
    
    logger.info(f"Final selection: {len(selected_chunks)} chunks, ~{total_tokens} tokens")
    
    return selected_chunks


def run_quiz_pipeline(
    quiz_id: int,
    document_id: int,
    num_questions: int,
    db: Session,
    config: QuizPipelineConfig,
    job_id: Optional[str] = None
) -> QuizPipelineResult:
    """
    Execute the full quiz generation pipeline.
    
    Steps:
    1. Fetch document chunks from database
    2. Smart chunk selection
    3. Call Gemini to generate MCQ questions
    4. Parse response and save to database
    5. Update quiz status to DRAFT
    
    Args:
        quiz_id: ID of quiz to populate
        document_id: ID of document to generate from
        num_questions: Number of questions to generate
        db: Database session
        config: QuizPipelineConfig with API keys and settings
        job_id: Optional RQ job ID for audit tracking
        
    Returns:
        QuizPipelineResult with success status and metadata
    """
    logger.info(f"Starting quiz generation pipeline for quiz_id={quiz_id}, document_id={document_id}")
    
    try:
        # Step 0: Get quiz and mark as GENERATING
        quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
        if not quiz:
            return QuizPipelineResult(
                success=False,
                quiz_id=quiz_id,
                error="Quiz not found"
            )
        
        quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.GENERATING)
        logger.info(f"Quiz {quiz_id} marked as GENERATING")
        
        # Update audit stage if job_id provided
        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.FETCHING_CHUNKS)
        
        # Step 1: Fetch document chunks
        logger.info("Step 1: Fetching document chunks...")
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()
        
        if not chunks:
            logger.error(f"No chunks found for document {document_id}")
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            return QuizPipelineResult(
                success=False,
                quiz_id=quiz_id,
                error="No chunks found for document",
                metadata={"error_stage": "FETCH_CHUNKS"}
            )
        
        logger.info(f"Found {len(chunks)} chunks")
        
        # Update audit stage
        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.SELECTING_CHUNKS)
        
        # Step 2: Smart chunk selection with token limit
        logger.info("Step 2: Selecting chunks based on question count...")
        selected_chunks = select_chunks_for_quiz(chunks, num_questions)
        
        # Combine selected chunks into context
        context = "\n\n".join([chunk.text for chunk in selected_chunks])
        total_tokens = sum(chunk.token_count or 0 for chunk in selected_chunks)
        logger.info(f"Selected {len(selected_chunks)}/{len(chunks)} chunks")
        logger.info(f"Total tokens: {total_tokens}")
        logger.info(f"Context length: {len(context)} characters")
        
        # Update audit stage
        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.CALLING_LLM)
        
        # Step 3: Call Gemini to generate questions
        logger.info(f"Step 3: Calling Gemini to generate {num_questions} questions...")
        questions_data = call_gemini_for_quiz(
            context=context,
            num_questions=num_questions,
            config=config
        )
        
        if not questions_data:
            logger.error("Gemini returned no questions")
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            return QuizPipelineResult(
                success=False,
                quiz_id=quiz_id,
                error="Failed to generate questions from LLM",
                metadata={"error_stage": "LLM_GENERATION"}
            )
        
        logger.info(f"Gemini generated {len(questions_data)} questions")
        
        # Update audit stage
        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.PARSING_RESPONSE)
        
        # Step 4: Save questions to database
        logger.info("Step 4: Saving questions to database...")
        
        # Update audit stage
        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.SAVING_QUESTIONS)
        
        questions_created = save_questions_to_db(
            db_session=db,
            quiz_id=quiz_id,
            questions_data=questions_data
        )
        
        # Step 5: Update quiz status to DRAFT and update total count
        logger.info("Step 5: Updating quiz status to DRAFT...")
        quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        quiz_repo.update_total_questions(db, quiz_id)
        
        # Update audit with results
        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.COMPLETED)
            quiz_audit_repo.update_results(
                db,
                job_id,
                questions_created=questions_created,
                total_chunks=len(chunks),
                chunks_selected=len(selected_chunks),
                total_tokens=total_tokens,
                generation_metadata={
                    "chunks_ratio": f"{(len(selected_chunks)/len(chunks)*100):.1f}%",
                    "context_length": len(context),
                    "questions_requested": num_questions,
                    "questions_generated": len(questions_data)
                }
            )
        
        logger.info(f"✓ Quiz generation completed successfully. Created {questions_created} questions")
        
        return QuizPipelineResult(
            success=True,
            quiz_id=quiz_id,
            questions_created=questions_created,
            metadata={
                "total_chunks": len(chunks),
                "chunks_selected": len(selected_chunks),
                "chunks_ratio": f"{(len(selected_chunks)/len(chunks)*100):.1f}%",
                "total_tokens": total_tokens,
                "context_length": len(context),
                "questions_requested": num_questions,
                "questions_generated": len(questions_data)
            }
        )
        
    except Exception as e:
        logger.error(f"Quiz generation pipeline failed: {e}", exc_info=True)
        
        # Update audit with error
        if job_id:
            quiz_audit_repo.update_error(db, job_id, str(e), "PIPELINE_ERROR")
        
        # Mark quiz as DRAFT (failed generation)
        try:
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            logger.info(f"Quiz {quiz_id} marked as DRAFT after failure")
        except Exception as update_error:
            logger.error(f"Failed to update quiz status: {update_error}")
        
        return QuizPipelineResult(
            success=False,
            quiz_id=quiz_id,
            error=str(e),
            metadata={"error_stage": "UNKNOWN"}
        )


def call_gemini_for_quiz(
    context: str,
    num_questions: int,
    config: QuizPipelineConfig
) -> Optional[List[Dict]]:
    """
    Call Gemini 2.5 Flash to generate quiz questions.
    
    Args:
        context: Combined text from document chunks
        num_questions: Number of questions to generate
        config: QuizPipelineConfig with API key and settings
        
    Returns:
        List of question dicts or None if failed
    """
    try:
        # Configure Gemini
        genai.configure(api_key=config.google_api_key)
        model = genai.GenerativeModel(config.model_name)
        
        # Build prompt
        prompt = f"""Based on the following document content, generate {num_questions} multiple choice questions to test understanding.

DOCUMENT CONTENT:
{context}

INSTRUCTIONS:
- Generate exactly {num_questions} questions
- Each question should have 4 options (A, B, C, D)
- Only one option should be correct
- Questions should test key concepts and important information
- Include a brief explanation for why the correct answer is right
- Return ONLY valid JSON, no markdown formatting or extra text

REQUIRED JSON FORMAT:
[
  {{
    "question": "What is...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_index": 0,
    "explanation": "Option A is correct because..."
  }}
]

Generate the questions now:"""
        
        logger.info("Sending request to Gemini...")
        response = model.generate_content(prompt)
        
        # Extract text from response
        response_text = response.text.strip()
        logger.info(f"Received response from Gemini: {len(response_text)} characters")
        
        # Clean up response (remove markdown code blocks if present)
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json
        if response_text.startswith("```"):
            response_text = response_text[3:]  # Remove ```
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove trailing ```
        response_text = response_text.strip()
        
        # Parse JSON
        questions_data = json.loads(response_text)
        
        # Validate structure
        if not isinstance(questions_data, list):
            logger.error("Response is not a list")
            return None
        
        # Validate each question
        valid_questions = []
        for i, q in enumerate(questions_data):
            if not all(k in q for k in ["question", "options", "correct_index"]):
                logger.warning(f"Question {i} missing required fields, skipping")
                continue
            
            if not isinstance(q["options"], list) or len(q["options"]) < 2:
                logger.warning(f"Question {i} has invalid options, skipping")
                continue
            
            if not (0 <= q["correct_index"] < len(q["options"])):
                logger.warning(f"Question {i} has invalid correct_index, skipping")
                continue
            
            valid_questions.append(q)
        
        logger.info(f"Validated {len(valid_questions)} questions")
        return valid_questions
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response as JSON: {e}")
        logger.error(f"Response text: {response_text[:500]}...")
        return None
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}", exc_info=True)
        return None


def save_questions_to_db(
    db_session: Session,
    quiz_id: int,
    questions_data: List[Dict]
) -> int:
    """
    Save generated questions to database.
    
    Args:
        db_session: Database session
        quiz_id: Quiz ID
        questions_data: List of question dicts from Gemini
        
    Returns:
        Number of questions created
    """
    questions_created = 0
    
    for i, q_data in enumerate(questions_data):
        try:
            # Prepare options
            options = [
                {"option_text": opt, "option_order": idx}
                for idx, opt in enumerate(q_data["options"])
            ]
            
            # Create question with options
            quiz_repo.create_question_with_options(
                db_session,
                quiz_id=quiz_id,
                question_text=q_data["question"],
                correct_answer_index=q_data["correct_index"],
                question_order=i,
                options=options,
                explanation=q_data.get("explanation")
            )
            
            questions_created += 1
            
        except Exception as e:
            logger.error(f"Failed to save question {i}: {e}")
            continue
    
    logger.info(f"Saved {questions_created} questions to database")
    return questions_created



def generate_quiz_task(
    quiz_id: int,
    document_id: int,
    num_questions: int,
    db_session: Session,
    google_api_key: str,
    job_id: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Task wrapper for RQ worker integration.
    Follows the same pattern as process_document_task.
    
    Args:
        quiz_id: Quiz ID to populate
        document_id: Document ID to generate from
        num_questions: Number of questions to generate
        db_session: Database session
        google_api_key: Google API key
        job_id: Optional RQ job ID for audit tracking
        **kwargs: Additional config options
        
    Returns:
        Dict with task result
    """
    config = QuizPipelineConfig(
        google_api_key=google_api_key,
        model_name=kwargs.get('model_name', 'gemini-2.5-flash'),
        max_retries=kwargs.get('max_retries', 3),
    )
    
    result = run_quiz_pipeline(quiz_id, document_id, num_questions, db_session, config, job_id=job_id)
    
    return {
        "success": result.success,
        "quiz_id": result.quiz_id,
        "questions_created": result.questions_created,
        "error": result.error,
        "metadata": result.metadata,
    }
