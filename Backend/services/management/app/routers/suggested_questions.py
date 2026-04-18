from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from app.deps.db import get_db
from app.deps.auth import get_current_admin
from app.services.suggested_questions_service import (
    generate_suggested_questions,
    update_suggested_questions,
    get_suggested_questions,
)

router = APIRouter()


class QuestionItem(BaseModel):
    id: Optional[str] = None
    text: str
    is_active: bool = True


class UpdateRequest(BaseModel):
    questions: List[QuestionItem]


@router.post("/documents/{document_id}/suggested-questions/generate", status_code=status.HTTP_200_OK)
def generate(
    document_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Auto-generate suggested questions (quiz questions first, then AI from chunks)."""
    return generate_suggested_questions(db, document_id=document_id)


@router.get("/documents/{document_id}/suggested-questions", status_code=status.HTTP_200_OK)
def get_admin(
    document_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    return get_suggested_questions(db, document_id=document_id, active_only=False)


@router.patch("/documents/{document_id}/suggested-questions", status_code=status.HTTP_200_OK)
def update(
    document_id: int,
    body: UpdateRequest,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    return update_suggested_questions(
        db,
        document_id=document_id,
        questions=[q.model_dump() for q in body.questions],
    )
