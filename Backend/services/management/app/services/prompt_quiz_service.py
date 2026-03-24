from sqlalchemy.orm import Session
from typing import Optional
from app.utils.response_utils import make_response
from shared.repos import quiz_repo
from shared.models import Quiz, QuizStatus
from shared.models.quiz import QuizSourceType
from app.services.queue.factory import get_queue

RQ_PROMPT_QUIZ_TASK = "tasks.generate_quiz_from_prompt"

MAX_PROMPT_CHARS = 500
MIN_PROMPT_CHARS = 20


def generate_prompt_quiz(
    db: Session,
    *,
    user_id: int,
    title: str,
    prompt_text: str,
    num_questions: int,
    description: Optional[str] = None,
):
    """Create a prompt quiz record and enqueue generation job."""
    if len(prompt_text.strip()) < MIN_PROMPT_CHARS:
        return make_response(False, f"Prompt must be at least {MIN_PROMPT_CHARS} characters", status_code=400)
    if len(prompt_text) > MAX_PROMPT_CHARS:
        prompt_text = prompt_text[:MAX_PROMPT_CHARS]

    if not (1 <= num_questions <= 20):
        return make_response(False, "num_questions must be between 1 and 20", status_code=400)

    quiz = quiz_repo.create_quiz(
        db,
        title=title,
        created_by=user_id,
        description=description,
        status=QuizStatus.GENERATING,
        source_type=QuizSourceType.PROMPT,
        prompt_text=prompt_text,
    )

    try:
        q = get_queue()
        job_id = q.enqueue(RQ_PROMPT_QUIZ_TASK, quiz_id=quiz.id, prompt_text=prompt_text, num_questions=num_questions)
        return make_response(True, "Prompt quiz generation started", data={
            "quiz_id": quiz.id, "job_id": str(job_id), "status": "GENERATING"
        }, status_code=202)
    except Exception as e:
        quiz_repo.update_quiz_status(db, quiz.id, QuizStatus.DRAFT)
        return make_response(False, "Failed to enqueue job", status_code=500, error=str(e))


def list_prompt_quizzes(db: Session):
    """List all prompt-based quizzes with their questions."""
    quizzes = quiz_repo.get_all_prompt_quizzes(db)
    result = []
    for q in quizzes:
        result.append({
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "prompt_text": q.prompt_text,
            "total_questions": q.total_questions,
            "status": q.status.value if hasattr(q.status, "value") else q.status,
            "created_by": q.created_by,
            "created_at": q.created_at,
            "updated_at": q.updated_at,
        })
    return make_response(True, "Prompt quizzes retrieved", data={"quizzes": result, "total": len(result)})


def get_prompt_quiz(db: Session, *, quiz_id: int):
    """Get a prompt quiz with all questions and options."""
    quiz = quiz_repo.get_prompt_quiz_with_questions(db, quiz_id)
    if not quiz:
        return make_response(False, "Prompt quiz not found", status_code=404)

    questions = []
    for q in quiz.questions:
        questions.append({
            "id": q.id,
            "quiz_id": q.quiz_id,
            "question_text": q.question_text,
            "question_order": q.question_order,
            "correct_answer_index": q.correct_answer_index,
            "explanation": q.explanation,
            "created_at": q.created_at,
            "updated_at": q.updated_at,
            "options": [
                {"id": o.id, "option_text": o.option_text, "option_order": o.option_order}
                for o in q.options
            ],
        })

    return make_response(True, "Prompt quiz retrieved", data={
        "id": quiz.id,
        "title": quiz.title,
        "description": quiz.description,
        "prompt_text": quiz.prompt_text,
        "total_questions": quiz.total_questions,
        "status": quiz.status.value if hasattr(quiz.status, "value") else quiz.status,
        "created_by": quiz.created_by,
        "created_at": quiz.created_at,
        "updated_at": quiz.updated_at,
        "questions": questions,
    })


def delete_prompt_quiz(db: Session, *, quiz_id: int, user_id: int):
    """Delete a prompt quiz (blocks if questions are referenced by course quizzes)."""
    quiz = quiz_repo.get_quiz_by_id(db, quiz_id)
    if not quiz:
        return make_response(False, "Prompt quiz not found", status_code=404)
    if quiz.created_by != user_id:
        return make_response(False, "Only creator can delete", status_code=403)

    ref_count = quiz_repo.get_course_quiz_references_for_quiz(db, quiz_id)
    if ref_count > 0:
        return make_response(
            False,
            f"Cannot delete: {ref_count} question(s) are referenced by course quizzes. Remove those references first.",
            status_code=409,
        )

    quiz_repo.delete_quiz(db, quiz_id)
    return make_response(True, "Prompt quiz deleted")
