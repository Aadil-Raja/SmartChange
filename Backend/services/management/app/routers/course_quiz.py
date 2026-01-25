from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import course_quiz_service
from app.utils.response_utils import make_response
from shared.models import User
import shared.schemas as schemas
from shared.schemas.course_quiz import QuestionTypeEnum

router = APIRouter()


# ============ Core Course Quiz Management ============
@router.post("/{course_id}/quizzes", status_code=status.HTTP_201_CREATED)
def create_course_quiz(
    course_id: int,
    payload: schemas.CourseQuizCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new course quiz"""
    try:
        return course_quiz_service.create_course_quiz(
            db,
            course_id=course_id,
            user_id=current_user.id,
            title=payload.title,
            description=payload.description
        )
    except Exception as e:
        return make_response(False, "Failed to create course quiz", status_code=500, error=str(e))


@router.get("/{course_quiz_id}", status_code=status.HTTP_200_OK)
def get_course_quiz(
    course_quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get course quiz with all questions and options"""
    try:
        return course_quiz_service.get_course_quiz(db, quiz_id=course_quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to fetch course quiz", status_code=500, error=str(e))


@router.get("/course/{course_id}", status_code=status.HTTP_200_OK)
def list_course_quizzes(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all quizzes for a course"""
    try:
        return course_quiz_service.list_course_quizzes(
            db,
            course_id=course_id,
            user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to fetch course quizzes", status_code=500, error=str(e))


@router.put("/{course_quiz_id}", status_code=status.HTTP_200_OK)
def update_course_quiz(
    course_quiz_id: int,
    payload: schemas.CourseQuizUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update course quiz title and description"""
    try:
        return course_quiz_service.update_course_quiz(
            db,
            quiz_id=course_quiz_id,
            user_id=current_user.id,
            title=payload.title,
            description=payload.description
        )
    except Exception as e:
        return make_response(False, "Failed to update course quiz", status_code=500, error=str(e))


@router.post("/{course_quiz_id}/publish", status_code=status.HTTP_200_OK)
def publish_course_quiz(
    course_quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Publish course quiz (make visible to employees)"""
    try:
        return course_quiz_service.publish_course_quiz(db, quiz_id=course_quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to publish course quiz", status_code=500, error=str(e))


@router.delete("/{course_quiz_id}", status_code=status.HTTP_200_OK)
def delete_course_quiz(
    course_quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a course quiz"""
    try:
        return course_quiz_service.delete_course_quiz(db, quiz_id=course_quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to delete course quiz", status_code=500, error=str(e))


# ============ Question Management ============
@router.post("/{course_quiz_id}/questions", status_code=status.HTTP_201_CREATED)
def add_question(
    course_quiz_id: int,
    payload: schemas.CourseQuizQuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a question to course quiz (referenced or custom)"""
    try:
        if payload.question_type == QuestionTypeEnum.REFERENCED:
            return course_quiz_service.add_referenced_question(
                db,
                quiz_id=course_quiz_id,
                user_id=current_user.id,
                source_document_question_id=payload.source_document_question_id
            )
        elif payload.question_type == QuestionTypeEnum.COURSE_SPECIFIC:
            options = [{"option_text": opt.option_text, "option_order": opt.option_order} for opt in payload.options]
            
            return course_quiz_service.add_course_specific_question(
                db,
                quiz_id=course_quiz_id,
                user_id=current_user.id,
                question_text=payload.question_text,
                correct_answer_index=payload.correct_answer_index,
                options=options,
                explanation=payload.explanation
            )
        else:
            return make_response(False, "Invalid question_type", status_code=400, 
                               error="question_type must be REFERENCED or COURSE_SPECIFIC")
    except Exception as e:
        return make_response(False, "Failed to add question", status_code=500, error=str(e))


@router.put("/questions/{question_id}", status_code=status.HTTP_200_OK)
def update_question(
    question_id: int,
    payload: schemas.CourseQuizQuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update any course quiz question - auto-converts REFERENCED to COURSE_SPECIFIC when edited"""
    try:
        options = None
        if payload.options:
            options = [{"option_text": opt.option_text, "option_order": opt.option_order} for opt in payload.options]
        
        return course_quiz_service.update_course_question(
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
    """Delete a question from course quiz"""
    try:
        return course_quiz_service.delete_course_question(db, question_id=question_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to delete question", status_code=500, error=str(e))


# ============ Helper Endpoints ============
@router.get("/course/{course_id}/available-questions", status_code=status.HTTP_200_OK)
def get_available_questions(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get available document questions for a course"""
    try:
        return course_quiz_service.get_available_questions(
            db,
            course_id=course_id,
            user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to fetch available questions", status_code=500, error=str(e))