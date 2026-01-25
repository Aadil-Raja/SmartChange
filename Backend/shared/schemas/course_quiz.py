from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum
from shared.models.course_quiz import QuizStatus
from shared.models.course_quiz_question import QuestionType


class QuestionTypeEnum(str, Enum):
    REFERENCED = "REFERENCED"
    COURSE_SPECIFIC = "COURSE_SPECIFIC"


# ============ Course Quiz Option Schemas ============
class CourseQuizOptionBase(BaseModel):
    option_text: str
    option_order: int = Field(ge=0, le=3)


class CourseQuizOptionCreate(CourseQuizOptionBase):
    pass


class CourseQuizOptionResponse(CourseQuizOptionBase):
    id: int

    class Config:
        from_attributes = True


# ============ Course Quiz Question Schemas ============
class CourseQuizQuestionBase(BaseModel):
    question_type: QuestionTypeEnum = Field(description="REFERENCED or COURSE_SPECIFIC")
    question_order: Optional[int] = Field(None, ge=0)


class CourseQuizQuestionCreate(CourseQuizQuestionBase):
    # For REFERENCED questions
    source_document_question_id: Optional[int] = None
    
    # For COURSE_SPECIFIC questions
    question_text: Optional[str] = None
    correct_answer_index: Optional[int] = Field(None, ge=0, le=3)
    explanation: Optional[str] = None
    options: Optional[List[CourseQuizOptionCreate]] = Field(None, min_length=2, max_length=4)


class CourseQuizQuestionUpdate(BaseModel):
    """Schema for updating any course quiz question - auto-converts REFERENCED to COURSE_SPECIFIC"""
    question_text: Optional[str] = None
    correct_answer_index: Optional[int] = Field(None, ge=0, le=3)
    explanation: Optional[str] = None
    options: Optional[List[CourseQuizOptionCreate]] = Field(None, min_length=2, max_length=4)


class CourseQuizQuestionResponse(BaseModel):
    id: int
    course_quiz_id: int
    question_type: str
    question_order: int
    question_text: str
    correct_answer_index: int
    explanation: Optional[str]
    
    # For REFERENCED questions
    source_document_question_id: Optional[int] = None
    
    # For COURSE_SPECIFIC questions
    course_question_detail_id: Optional[int] = None
    
    options: List[CourseQuizOptionResponse]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============ Course Quiz Schemas ============
class CourseQuizCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    prerequisite_content_ids: List[int] = Field(default=[], description="Content item IDs that must be completed before quiz unlocks")


class CourseQuizUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    prerequisite_content_ids: Optional[List[int]] = Field(None, description="Content item IDs that must be completed before quiz unlocks")


class CourseQuizResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str]
    total_questions: int
    prerequisite_content_ids: List[int]
    status: QuizStatus
    created_by: int
    created_at: datetime
    updated_at: Optional[datetime]
    published_at: Optional[datetime]
    
    # Runtime fields (not stored in DB)
    is_unlocked: Optional[bool] = Field(None, description="Whether quiz is unlocked for current user")
    missing_prerequisites: Optional[List[int]] = Field(None, description="Content item IDs still needed to unlock")

    class Config:
        from_attributes = True


class CourseQuizDetailResponse(CourseQuizResponse):
    questions: List[CourseQuizQuestionResponse]

    class Config:
        from_attributes = True


class CourseQuizListResponse(BaseModel):
    quizzes: List[CourseQuizResponse]
    total: int


# ============ Available Questions Schema ============
class AvailableQuestionResponse(BaseModel):
    id: int
    quiz_id: int
    question_text: str
    correct_answer_index: int
    explanation: Optional[str]
    options: List[CourseQuizOptionResponse]

    class Config:
        from_attributes = True


class AvailableQuestionsListResponse(BaseModel):
    questions: List[AvailableQuestionResponse]
    total: int