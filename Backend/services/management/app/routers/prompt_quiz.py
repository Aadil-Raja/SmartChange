from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from typing import Optional
from sqlalchemy.orm import Session

from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import prompt_quiz_service
from app.utils.response_utils import make_response
from shared.models import User

router = APIRouter()


class PromptQuizGenerateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    prompt_text: str = Field(min_length=20, max_length=500,
                             description="What to generate questions about (20-500 chars)")
    num_questions: int = Field(default=10, ge=1, le=20)
    description: Optional[str] = None


@router.post("/generate", status_code=status.HTTP_202_ACCEPTED)
def generate_prompt_quiz(
    payload: PromptQuizGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate quiz questions from a free-text prompt."""
    try:
        return prompt_quiz_service.generate_prompt_quiz(
            db,
            user_id=current_user.id,
            title=payload.title,
            prompt_text=payload.prompt_text,
            num_questions=payload.num_questions,
            description=payload.description,
        )
    except Exception as e:
        return make_response(False, "Failed to generate prompt quiz", status_code=500, error=str(e))


@router.get("", status_code=status.HTTP_200_OK)
def list_prompt_quizzes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all prompt-based quizzes."""
    try:
        return prompt_quiz_service.list_prompt_quizzes(db)
    except Exception as e:
        return make_response(False, "Failed to list prompt quizzes", status_code=500, error=str(e))


@router.get("/{quiz_id}", status_code=status.HTTP_200_OK)
def get_prompt_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a prompt quiz with all questions."""
    try:
        return prompt_quiz_service.get_prompt_quiz(db, quiz_id=quiz_id)
    except Exception as e:
        return make_response(False, "Failed to get prompt quiz", status_code=500, error=str(e))


@router.delete("/{quiz_id}", status_code=status.HTTP_200_OK)
def delete_prompt_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a prompt quiz."""
    try:
        return prompt_quiz_service.delete_prompt_quiz(db, quiz_id=quiz_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to delete prompt quiz", status_code=500, error=str(e))
