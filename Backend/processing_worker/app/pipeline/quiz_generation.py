"""
Quiz Generation Pipeline - Uses LLM (OpenAI/Gemini) to generate MCQ questions
from document chunks OR a free-text prompt.
"""

import logging
import json
import random
from typing import List, Dict, Optional, Any
from sqlalchemy.orm import Session

from shared.models import DocumentChunk, Quiz, QuizStatus, QuizGenerationStage
from shared.repos import quiz_repo, quiz_audit_repo
from shared.llm import get_llm_provider, BaseLLMProvider

logger = logging.getLogger(__name__)

MAX_QUESTIONS = 20
MIN_CHUNKS = 5
MAX_TOKENS = 50000
MAX_PROMPT_CHARS = 500  # guardrail for prompt-based generation


class QuizPipelineConfig:
    def __init__(self, llm_provider: str, llm_model: str, api_key: str, max_retries: int = 3):
        self.llm_provider = llm_provider
        self.llm_model = llm_model
        self.api_key = api_key
        self.max_retries = max_retries


class QuizPipelineResult:
    def __init__(self, success: bool, quiz_id: int, questions_created: int = 0,
                 error: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        self.success = success
        self.quiz_id = quiz_id
        self.questions_created = questions_created
        self.error = error
        self.metadata = metadata or {}


# ─────────────────────────────────────────────
# Shared helpers
# ─────────────────────────────────────────────

def _call_llm(context: str, num_questions: int, config: QuizPipelineConfig) -> Optional[List[Dict]]:
    """Call LLM and return validated list of question dicts."""
    try:
        llm = get_llm_provider(provider=config.llm_provider, api_key=config.api_key, model=config.llm_model)
        prompt = f"""Generate {num_questions} multiple choice questions based on the content below.

CONTENT:
{context}

INSTRUCTIONS:
- Generate exactly {num_questions} questions
- Each question must have exactly 4 options
- Only one option is correct
- Include a brief explanation for the correct answer
- Return valid JSON only

REQUIRED JSON FORMAT:
{{
  "questions": [
    {{
      "question": "What is...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Option A is correct because..."
    }}
  ]
}}"""

        data = llm.generate_json(prompt)

        if isinstance(data, dict):
            if "questions" in data:
                data = data["questions"]
            elif "items" in data:
                data = data["items"]
            else:
                data = [data]

        if not isinstance(data, list):
            logger.error(f"LLM response is not a list: {type(data)}")
            return None

        valid = []
        for i, q in enumerate(data):
            if not all(k in q for k in ["question", "options", "correct_index"]):
                logger.warning(f"Question {i} missing fields, skipping")
                continue
            if not isinstance(q["options"], list) or len(q["options"]) < 2:
                logger.warning(f"Question {i} invalid options, skipping")
                continue
            if not (0 <= q["correct_index"] < len(q["options"])):
                logger.warning(f"Question {i} invalid correct_index, skipping")
                continue
            valid.append(q)

        logger.info(f"Validated {len(valid)} questions from LLM")
        return valid

    except Exception as e:
        logger.error(f"LLM call failed: {e}", exc_info=True)
        return None


def _save_questions(db: Session, quiz_id: int, questions_data: List[Dict]) -> int:
    """Persist generated questions to DB, return count saved."""
    saved = 0
    for i, q in enumerate(questions_data):
        try:
            options = [{"option_text": opt, "option_order": idx} for idx, opt in enumerate(q["options"])]
            quiz_repo.create_question_with_options(
                db,
                quiz_id=quiz_id,
                question_text=q["question"],
                correct_answer_index=q["correct_index"],
                question_order=i,
                options=options,
                explanation=q.get("explanation"),
            )
            saved += 1
        except Exception as e:
            logger.error(f"Failed to save question {i}: {e}")
    logger.info(f"Saved {saved} questions to DB")
    return saved


# ─────────────────────────────────────────────
# Document-based pipeline
# ─────────────────────────────────────────────

def select_chunks_for_quiz(chunks: List[DocumentChunk], num_questions: int) -> List[DocumentChunk]:
    if not chunks:
        return []
    total = len(chunks)
    ratio = num_questions / MAX_QUESTIONS
    to_use = max(min(MIN_CHUNKS, total), int(total * ratio))
    to_use = min(to_use, total)

    selected = list(chunks) if to_use >= total else random.sample(chunks, to_use)

    total_tokens = sum(c.token_count or 0 for c in selected)
    min_keep = min(MIN_CHUNKS, total, 1)
    while total_tokens > MAX_TOKENS and len(selected) > min_keep:
        removed = selected.pop(random.randint(0, len(selected) - 1))
        total_tokens -= (removed.token_count or 0)

    selected.sort(key=lambda c: c.chunk_index)
    return selected


def run_quiz_pipeline(
    quiz_id: int,
    document_id: int,
    num_questions: int,
    db: Session,
    config: QuizPipelineConfig,
    job_id: Optional[str] = None,
) -> QuizPipelineResult:
    logger.info(f"Starting document quiz pipeline quiz_id={quiz_id} document_id={document_id}")
    try:
        quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
        if not quiz:
            return QuizPipelineResult(False, quiz_id, error="Quiz not found")

        quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.GENERATING)

        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.FETCHING_CHUNKS)

        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()

        if not chunks:
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            return QuizPipelineResult(False, quiz_id, error="No chunks found for document")

        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.SELECTING_CHUNKS)

        selected = select_chunks_for_quiz(chunks, num_questions)
        context = "\n\n".join(c.text for c in selected)
        total_tokens = sum(c.token_count or 0 for c in selected)

        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.CALLING_LLM)

        questions_data = _call_llm(context, num_questions, config)
        if not questions_data:
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            return QuizPipelineResult(False, quiz_id, error="LLM returned no questions")

        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.SAVING_QUESTIONS)

        created = _save_questions(db, quiz_id, questions_data)
        quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        quiz_repo.update_total_questions(db, quiz_id)

        if job_id:
            quiz_audit_repo.update_stage(db, job_id, QuizGenerationStage.COMPLETED)
            quiz_audit_repo.update_results(
                db, job_id,
                questions_created=created,
                total_chunks=len(chunks),
                chunks_selected=len(selected),
                total_tokens=total_tokens,
                generation_metadata={
                    "chunks_ratio": f"{(len(selected)/len(chunks)*100):.1f}%",
                    "context_length": len(context),
                    "questions_requested": num_questions,
                    "questions_generated": len(questions_data),
                },
            )

        return QuizPipelineResult(True, quiz_id, questions_created=created, metadata={
            "total_chunks": len(chunks),
            "chunks_selected": len(selected),
            "total_tokens": total_tokens,
            "questions_requested": num_questions,
            "questions_generated": len(questions_data),
        })

    except Exception as e:
        logger.error(f"Document quiz pipeline failed: {e}", exc_info=True)
        if job_id:
            quiz_audit_repo.update_error(db, job_id, str(e), "PIPELINE_ERROR")
        try:
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        except Exception:
            pass
        return QuizPipelineResult(False, quiz_id, error=str(e), metadata={"error_stage": "UNKNOWN"})


# ─────────────────────────────────────────────
# Prompt-based pipeline
# ─────────────────────────────────────────────

def run_prompt_quiz_pipeline(
    quiz_id: int,
    prompt_text: str,
    num_questions: int,
    db: Session,
    config: QuizPipelineConfig,
) -> QuizPipelineResult:
    """
    Generate quiz questions from a free-text prompt (no document needed).
    Guardrails: prompt truncated to MAX_PROMPT_CHARS before sending to LLM.
    """
    logger.info(f"Starting prompt quiz pipeline quiz_id={quiz_id}")
    try:
        quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
        if not quiz:
            return QuizPipelineResult(False, quiz_id, error="Quiz not found")

        quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.GENERATING)

        # Enforce prompt length guardrail
        safe_prompt = prompt_text[:MAX_PROMPT_CHARS]

        questions_data = _call_llm(
            context=f"Topic/Instructions: {safe_prompt}",
            num_questions=num_questions,
            config=config,
        )

        if not questions_data:
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
            return QuizPipelineResult(False, quiz_id, error="LLM returned no questions")

        created = _save_questions(db, quiz_id, questions_data)
        quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        quiz_repo.update_total_questions(db, quiz_id)

        logger.info(f"Prompt quiz pipeline done. Created {created} questions.")
        return QuizPipelineResult(True, quiz_id, questions_created=created, metadata={
            "prompt_length": len(prompt_text),
            "questions_requested": num_questions,
            "questions_generated": len(questions_data),
        })

    except Exception as e:
        logger.error(f"Prompt quiz pipeline failed: {e}", exc_info=True)
        try:
            quiz_repo.update_quiz_status(db, quiz_id, QuizStatus.DRAFT)
        except Exception:
            pass
        return QuizPipelineResult(False, quiz_id, error=str(e), metadata={"error_stage": "UNKNOWN"})


# ─────────────────────────────────────────────
# RQ task wrappers
# ─────────────────────────────────────────────

def generate_quiz_task(
    quiz_id: int,
    document_id: int,
    num_questions: int,
    db_session: Session,
    llm_provider: str,
    llm_model: str,
    api_key: str,
    job_id: Optional[str] = None,
    **kwargs,
) -> Dict[str, Any]:
    config = QuizPipelineConfig(llm_provider=llm_provider, llm_model=llm_model, api_key=api_key)
    result = run_quiz_pipeline(quiz_id, document_id, num_questions, db_session, config, job_id=job_id)
    return {"success": result.success, "quiz_id": result.quiz_id,
            "questions_created": result.questions_created, "error": result.error, "metadata": result.metadata}


def generate_prompt_quiz_task(
    quiz_id: int,
    prompt_text: str,
    num_questions: int,
    db_session: Session,
    llm_provider: str,
    llm_model: str,
    api_key: str,
    **kwargs,
) -> Dict[str, Any]:
    config = QuizPipelineConfig(llm_provider=llm_provider, llm_model=llm_model, api_key=api_key)
    result = run_prompt_quiz_pipeline(quiz_id, prompt_text, num_questions, db_session, config)
    return {"success": result.success, "quiz_id": result.quiz_id,
            "questions_created": result.questions_created, "error": result.error, "metadata": result.metadata}
