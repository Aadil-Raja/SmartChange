from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CourseEnrollmentBase(BaseModel):
    user_id: int
    course_id: int


class CourseEnrollmentCreate(CourseEnrollmentBase):
    """Schema for creating a new enrollment"""
    pass


class CourseEnrollmentOut(CourseEnrollmentBase):
    """Schema for enrollment output with calculated deadline fields"""
    id: int
    enrolled_at: datetime
    completed_at: Optional[datetime] = None
    
    # Calculated fields (not stored in DB, computed dynamically)
    deadline_at: Optional[datetime] = None
    is_expired: bool = False
    days_remaining: Optional[int] = None
    weeks_remaining: Optional[float] = None
    
    class Config:
        from_attributes = True


class EnrollmentStatus(BaseModel):
    """Comprehensive status of user's enrollment in a course"""
    is_enrolled: bool
    enrolled_at: Optional[datetime] = None
    deadline_at: Optional[datetime] = None
    is_expired: bool = False
    can_interact: bool = True  # False if expired or not enrolled
    days_remaining: Optional[int] = None
    weeks_remaining: Optional[float] = None
    status: str  # "not_enrolled" | "active" | "warning" | "urgent" | "expired" | "completed"
    
    class Config:
        from_attributes = True
