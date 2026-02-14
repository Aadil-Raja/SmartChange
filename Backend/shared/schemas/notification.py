"""
Pydantic schemas for notification API requests and responses.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from shared.models.notification import NotificationType


class NotificationOut(BaseModel):
    """Schema for notification response"""
    id: int
    type: NotificationType
    title: str
    message: str
    is_read: bool
    created_at: datetime
    sender_id: Optional[int] = None
    sender_name: Optional[str] = None
    related_course_id: Optional[int] = None
    related_course_title: Optional[str] = None
    related_team_id: Optional[int] = None
    related_team_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    """Schema for paginated notification list"""
    notifications: List[NotificationOut]
    total: int
    page: int
    pages: int
    unread_count: int


class SendDirectMessageIn(BaseModel):
    """Schema for sending direct message from manager to employee"""
    team_id: int = Field(..., description="Team ID for verification")
    recipient_user_id: int = Field(..., description="Employee user ID")
    title: str = Field(..., min_length=1, max_length=255, description="Message title")
    message: str = Field(..., min_length=1, max_length=1000, description="Message content")
    related_course_id: Optional[int] = Field(None, description="Optional course to link")


class UnreadCountResponse(BaseModel):
    """Schema for unread count response"""
    unread_count: int
