from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from shared.models.quiz import QuizStatus


# ============ Quiz Option Schemas ============
class QuizOptionBase(BaseModel):
    option_text: str
    option_order: int = Field(ge=0, le=3)


class QuizOptionCreate(QuizOptionBase):
    pass


class QuizOptionResponse(QuizOptionBase):
    id: int

    class Config:
        from_attributes = True


# ============ Quiz Question Schemas ============
class QuizQuestionBase(BaseModel):
    question_text: str
    question_order: int = Field(ge=0)
    correct_answer_index: int = Field(ge=0, le=3)
    explanation: Optional[str] = None


class QuizQuestionCreate(QuizQuestionBase):
    options: List[QuizOptionCreate] = Field(min_length=2, max_length=4)


class QuizQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    correct_answer_index: Optional[int] = Field(None, ge=0, le=3)
    explanation: Optional[str] = None
    options: Optional[List[QuizOptionCreate]] = Field(None, min_length=2, max_length=4)


class QuizQuestionResponse(QuizQuestionBase):
    id: int
    quiz_id: int
    options: List[QuizOptionResponse]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============ Quiz Schemas ============
class QuizGenerateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    num_questions: int = Field(ge=5, le=20, description="Number of questions to generate (5-20)")


class QuizCreateManual(BaseModel):
    document_id: int
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None


class QuizUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None


class QuizResponse(BaseModel):
    id: int
    document_id: int
    title: str
    description: Optional[str]
    total_questions: int
    status: QuizStatus
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime]
    published_at: Optional[datetime]

    class Config:
        from_attributes = True


class QuizDetailResponse(QuizResponse):
    questions: List[QuizQuestionResponse]

    class Config:
        from_attributes = True


class QuizListResponse(BaseModel):
    quizzes: List[QuizResponse]
    total: int


class QuizGenerateResponse(BaseModel):
    quiz_id: int
    status: str
    message: str
