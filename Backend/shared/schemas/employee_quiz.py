from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# ============ Streamlined Employee Quiz Schemas ============

class EmployeeQuizCardResponse(BaseModel):
    """Minimal quiz info for course page cards"""
    id: int
    title: str
    status: str  # "can_take", "completed", "locked", "in_cooldown", "max_attempts_reached"
    attempts_remaining: int
    best_score: Optional[float]
    next_attempt_at: Optional[datetime]

    class Config:
        from_attributes = True


class EmployeeQuizTakingResponse(BaseModel):
    """Quiz data for taking (questions only)"""
    id: int
    title: str
    questions: List['EmployeeQuizQuestionResponse']
    attempt_number: int
    max_attempts: int

    class Config:
        from_attributes = True


class QuizResultResponse(BaseModel):
    """Streamlined quiz results for learning"""
    attempt_id: int
    score: int
    total_questions: int
    percentage: float
    passed: bool
    can_retake: bool
    results: List['QuizQuestionResultResponse']

    class Config:
        from_attributes = True


class QuizQuestionResultResponse(BaseModel):
    """Simplified question result for learning"""
    question_id: int
    question_text: str
    user_answer: str
    user_option_id: Optional[int]
    correct_answer: str
    correct_option_id: Optional[int]
    is_correct: bool
    explanation: Optional[str]

    class Config:
        from_attributes = True


# ============ Original Employee Quiz Schemas (Backward Compatibility) ============

class EmployeeQuizOptionResponse(BaseModel):
    """Quiz option for employees - no indication of correct answer"""
    id: int
    option_text: str
    option_order: int

    class Config:
        from_attributes = True


class EmployeeQuizQuestionResponse(BaseModel):
    """Quiz question for employees - no correct answer or explanation"""
    id: int
    question_text: str
    question_order: int
    options: List[EmployeeQuizOptionResponse]

    class Config:
        from_attributes = True


class EmployeeQuizResponse(BaseModel):
    """Quiz for employees to take - no answers exposed"""
    id: int
    title: str
    description: Optional[str]
    total_questions: int
    questions: List[EmployeeQuizQuestionResponse]

    class Config:
        from_attributes = True


class QuizAttemptSubmission(BaseModel):
    """Schema for submitting quiz answers"""
    answers: dict = Field(
        ..., 
        description="Question ID to selected option index mapping",
        example={"10": 1, "11": 0, "12": 2}
    )


class QuizAttemptResult(BaseModel):
    """Basic quiz attempt result"""
    attempt_id: int
    score: int
    total_questions: int
    percentage: float
    passed: bool
    completed_at: datetime

    class Config:
        from_attributes = True


class QuizQuestionResult(BaseModel):
    """Detailed result for a single question"""
    question_id: int
    question_text: str
    question_order: int
    user_answer: Optional[int]
    user_answer_text: str
    correct_answer: int
    correct_answer_text: str
    is_correct: bool
    explanation: Optional[str]
    options: List[EmployeeQuizOptionResponse]

    class Config:
        from_attributes = True


class QuizAttemptDetailedResult(BaseModel):
    """Detailed quiz attempt result with question-by-question breakdown"""
    attempt_id: int
    score: int
    total_questions: int
    percentage: float
    passed: bool
    completed_at: datetime
    results: List[QuizQuestionResult]

    class Config:
        from_attributes = True