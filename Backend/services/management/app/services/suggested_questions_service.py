"""
Suggested questions service.
Generates or manages suggested questions stored as JSON on the Document model.
"""
import random
import uuid
from typing import List
from sqlalchemy.orm import Session

from shared.models.Document import Document, DocumentChunk
from shared.models.quiz import Quiz
from shared.models.quiz_question import QuizQuestion
from shared.llm import create_llm_provider
from app.core.config import get_settings
from app.utils.response_utils import make_response

MAX_QUESTIONS = 5
settings = get_settings()


def _make_question(text: str) -> dict:
    return {"id": str(uuid.uuid4()), "text": text.strip(), "is_active": True}


def _get_quiz_question_texts(db: Session, document_id: int) -> List[str]:
    """Fetch question texts from all quizzes linked to this document (any status).
    Deduplicates by lowercased text to avoid near-identical questions from multiple quizzes.
    """
    rows = (
        db.query(QuizQuestion.question_text)
        .join(Quiz, QuizQuestion.quiz_id == Quiz.id)
        .filter(Quiz.document_id == document_id)
        .all()
    )
    seen = set()
    unique = []
    for (text,) in rows:
        if not text:
            continue
        key = text.strip().lower()
        if key not in seen:
            seen.add(key)
            unique.append(text.strip())
    return unique


def _generate_from_chunks(db: Session, document_id: int, count: int) -> List[str]:
    """Pick random chunks and ask LLM to generate open-ended questions."""
    chunks = (
        db.query(DocumentChunk.text)
        .filter(DocumentChunk.document_id == document_id)
        .all()
    )
    if not chunks:
        return []

    sample = random.sample(chunks, min(count, len(chunks)))
    passages = "\n\n".join([f"Passage {i+1}:\n{c[0][:600]}" for i, c in enumerate(sample)])

    llm = create_llm_provider(
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        google_api_key=settings.google_api_key,
        openai_api_key=settings.openai_api_key,
    )

    prompt = f"""You are generating suggested questions for a document chatbot.
Given the following passages from a document, generate exactly {count} short, open-ended conversational questions that an employee might ask about this document.

Rules:
- Each question should be answerable from the document content
- Keep questions concise (under 15 words)
- Make them natural, like something a person would actually type
- Return ONLY a JSON array of strings, no explanation

{passages}

Return format:
["Question 1?", "Question 2?", ...]"""

    result = llm.generate_json(prompt)

    # Handle both list response and dict with a key
    if isinstance(result, list):
        questions = result
    elif isinstance(result, dict):
        questions = next((v for v in result.values() if isinstance(v, list)), [])
    else:
        questions = []

    return [str(q).strip() for q in questions if q][:count]


def generate_suggested_questions(db: Session, *, document_id: int):
    """
    Generate suggested questions for a document and save to document.suggested_questions.
    Auto-strategy: quiz questions first (if any exist), fill remainder with AI from chunks.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return make_response(False, "Document not found", status_code=404)

    if doc.status.value != "PROCESSED":
        return make_response(False, "Document must be processed first", status_code=400)

    quiz_texts = _get_quiz_question_texts(db, document_id)

    if len(quiz_texts) >= MAX_QUESTIONS:
        questions = random.sample(quiz_texts, MAX_QUESTIONS)
    elif quiz_texts:
        needed = MAX_QUESTIONS - len(quiz_texts)
        ai_questions = _generate_from_chunks(db, document_id, needed)
        questions = quiz_texts + ai_questions
    else:
        questions = _generate_from_chunks(db, document_id, MAX_QUESTIONS)

    built = [_make_question(q) for q in questions[:MAX_QUESTIONS] if q]
    doc.suggested_questions = {"questions": built}
    db.commit()

    return make_response(True, "Suggested questions generated", data={"questions": built})


def update_suggested_questions(db: Session, *, document_id: int, questions: list):
    """
    Admin manually sets/edits the suggested questions array.
    Max 5 enforced.
    """
    if len(questions) > MAX_QUESTIONS:
        return make_response(
            False, f"Maximum {MAX_QUESTIONS} suggested questions allowed", status_code=400
        )

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return make_response(False, "Document not found", status_code=404)

    # Ensure each item has an id
    built = []
    for q in questions:
        built.append({
            "id": q.get("id") or str(uuid.uuid4()),
            "text": str(q.get("text", "")).strip(),
            "is_active": bool(q.get("is_active", True)),
        })

    doc.suggested_questions = {"questions": built}
    db.commit()

    return make_response(True, "Suggested questions updated", data={"questions": built})


def get_suggested_questions(db: Session, *, document_id: int, active_only: bool = True):
    """
    Return suggested questions for a document.
    active_only=True for employee chatbot, False for admin management.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return make_response(False, "Document not found", status_code=404)

    all_questions = (doc.suggested_questions or {}).get("questions", [])

    if active_only:
        all_questions = [q for q in all_questions if q.get("is_active", True)]

    return make_response(True, "OK", data={"questions": all_questions})
