from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import quiz_service
from app.utils.response_utils import make_response
from shared.models import User
import shared.schemas as schemas

router = APIRouter()


# ============ Statistics ============
@router.get("/stats", status_code=status.HTTP_200_OK)
def get_quiz_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz statistics including total quizzes, published count, and per-document counts"""
    try:
        return quiz_service.get_quiz_stats(db, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to fetch quiz statistics", status_code=500, error=str(e))


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_quiz(
    document_id: int,
    payload: schemas.QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate quiz questions from a processed document using LLM.
    Returns immediately with job ID while generation happens in background.
    """
    try:
        return quiz_service.generate_quiz(
            db,
            document_id=document_id,
            user_id=current_user.id,
            title=payload.title,
            num_questions=payload.num_questions,
            description=payload.description
        )
    except Exception as e:
        return make_response(False, "Failed to generate quiz", status_code=500, error=str(e))


@router.get("/{quiz_id}", status_code=status.HTTP_200_OK)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz with all questions and options"""
    try:
        return quiz_service.get_quiz(db, quiz_id=quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to fetch quiz", status_code=500, error=str(e))


@router.get("/document/{document_id}", status_code=status.HTTP_200_OK)
def list_document_quizzes(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all quizzes for a document"""
    try:
        return quiz_service.list_document_quizzes(
            db,
            document_id=document_id,
            user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to fetch quizzes", status_code=500, error=str(e))


@router.put("/{quiz_id}", status_code=status.HTTP_200_OK)
def update_quiz(
    quiz_id: int,
    payload: schemas.QuizUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update quiz title and description"""
    try:
        return quiz_service.update_quiz(
            db,
            quiz_id=quiz_id,
            user_id=current_user.id,
            title=payload.title,
            description=payload.description
        )
    except Exception as e:
        return make_response(False, "Failed to update quiz", status_code=500, error=str(e))


@router.post("/{quiz_id}/publish", status_code=status.HTTP_200_OK)
def publish_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Publish quiz (make visible to employees)"""
    try:
        return quiz_service.publish_quiz(db, quiz_id=quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to publish quiz", status_code=500, error=str(e))


@router.delete("/{quiz_id}", status_code=status.HTTP_200_OK)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a quiz"""
    try:
        return quiz_service.delete_quiz(db, quiz_id=quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to delete quiz", status_code=500, error=str(e))


# ============ Question Management ============
@router.post("/{quiz_id}/questions", status_code=status.HTTP_201_CREATED)
def add_question(
    quiz_id: int,
    payload: schemas.QuizQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually add a question to quiz"""
    try:
        options = [{"option_text": opt.option_text, "option_order": opt.option_order} for opt in payload.options]
        
        return quiz_service.add_question(
            db,
            quiz_id=quiz_id,
            user_id=current_user.id,
            question_text=payload.question_text,
            correct_answer_index=payload.correct_answer_index,
            options=options,
            explanation=payload.explanation
        )
    except Exception as e:
        return make_response(False, "Failed to add question", status_code=500, error=str(e))


@router.put("/questions/{question_id}", status_code=status.HTTP_200_OK)
def update_question(
    question_id: int,
    payload: schemas.QuizQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a question"""
    try:
        options = None
        if payload.options:
            options = [{"option_text": opt.option_text, "option_order": opt.option_order} for opt in payload.options]
        
        return quiz_service.update_question(
            db,
            question_id=question_id,
            user_id=current_user.id,
            question_text=payload.question_text,
            correct_answer_index=payload.correct_answer_index,
            explanation=payload.explanation,
            options=options
        )
    except Exception as e:
        return make_response(False, "Failed to update question", status_code=500, error=str(e))


@router.delete("/questions/{question_id}", status_code=status.HTTP_200_OK)
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a question"""
    try:
        return quiz_service.delete_question(db, question_id=question_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to delete question", status_code=500, error=str(e))



# ============ Audit Endpoints ============
@router.get("/{quiz_id}/audit", status_code=status.HTTP_200_OK)
def get_quiz_audit(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get audit record for a quiz"""
    try:
        return quiz_service.get_quiz_audit(db, quiz_id=quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to fetch audit", status_code=500, error=str(e))


@router.get("/audits/list", status_code=status.HTTP_200_OK)
def list_quiz_audits(
    limit: int = Query(50, ge=1, le=200),
    status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List recent quiz generation audits"""
    try:
        return quiz_service.list_quiz_audits(
            db, 
            user_id=current_user.id, 
            limit=limit, 
            status=status
        )
    except Exception as e:
        return make_response(False, "Failed to fetch audits", status_code=500, error=str(e))
