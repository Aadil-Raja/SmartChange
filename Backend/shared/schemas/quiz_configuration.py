from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class QuizConfigurationBase(BaseModel):
    """Base quiz configuration schema"""
    max_attempts: int = Field(ge=1, le=10, description="Maximum number of attempts allowed (1-10)")
    passing_score: float = Field(ge=50.0, le=100.0, description="Minimum score to pass (50-100%)")
    cooldown_minutes: int = Field(ge=0, le=1440, description="Minutes to wait between attempts (0-1440)")


class QuizConfigurationCreate(QuizConfigurationBase):
    """Schema for creating quiz configuration"""
    pass


class QuizConfigurationUpdate(QuizConfigurationBase):
    """Schema for updating quiz configuration"""
    pass


class QuizConfigurationResponse(QuizConfigurationBase):
    """Schema for quiz configuration response"""
    id: int
    quiz_id: int
    created_at: datetime
    updated_at: datetime
    created_by: Optional[int]

    class Config:
        from_attributes = True


class QuizConfigurationSummary(QuizConfigurationBase):
    """Simplified configuration schema for API responses"""
    pass