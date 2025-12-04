from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import quiz_service
from shared.models import User
from shared.schemas import (
    QuizGenerateRequest,
    QuizGenerateResponse,
    QuizResponse,
    QuizDetailResponse,
    QuizListResponse,
    QuizUpdateRequest,
    QuizQuestionCreate,
    QuizQuestionUpdate,
    QuizQuestionResponse
)

router = APIRouter(prefix="/quizzes", tags=["Quizzes"])


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_quiz(
    document_id: int,
    payload: QuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate quiz questions from a processed document using LLM.
    Returns immediately with job ID while generation happens in background.
    """
    return quiz_service.generate_quiz(
        db,
        document_id=document_id,
        user_id=current_user.id,
        title=payload.title,
        num_questions=payload.num_questions,
        description=payload.description
    )


@router.get("/{quiz_id}")
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz with all questions and options"""
    return quiz_service.get_quiz(db, quiz_id=quiz_id, user_id=current_user.id)


@router.get("/document/{document_id}")
def list_document_quizzes(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all quizzes for a document"""
    return quiz_service.list_document_quizzes(
        db,
        document_id=document_id,
        user_id=current_user.id
    )


@router.put("/{quiz_id}")
def update_quiz(
    quiz_id: int,
    payload: QuizUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update quiz title and description"""
    return quiz_service.update_quiz(
        db,
        quiz_id=quiz_id,
        user_id=current_user.id,
        title=payload.title,
        description=payload.description
    )


@router.post("/{quiz_id}/publish")
def publish_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Publish quiz (make visible to employees)"""
    return quiz_service.publish_quiz(db, quiz_id=quiz_id, user_id=current_user.id)


@router.delete("/{quiz_id}")
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a quiz"""
    return quiz_service.delete_quiz(db, quiz_id=quiz_id, user_id=current_user.id)


# ============ Question Management ============
@router.post("/{quiz_id}/questions", status_code=status.HTTP_201_CREATED)
def add_question(
    quiz_id: int,
    payload: QuizQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually add a question to quiz"""
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


@router.put("/questions/{question_id}")
def update_question(
    question_id: int,
    payload: QuizQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a question"""
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


@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a question"""
    return quiz_service.delete_question(db, question_id=question_id, user_id=current_user.id)
