"""
Notification model for user notifications system.
Supports system notifications, team announcements, and direct messages.
"""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from shared.models.user import Base


class NotificationType(str, enum.Enum):
    """Types of notifications"""
    SYSTEM = "system"
    TEAM_ANNOUNCEMENT = "team_announcement"
    DIRECT_MESSAGE = "direct_message"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(SQLEnum(NotificationType), nullable=False, default=NotificationType.SYSTEM)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    
    # Optional fields
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    related_course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True)
    related_team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="notifications")
    sender = relationship("User", foreign_keys=[sender_id])
    course = relationship("Course", foreign_keys=[related_course_id])
    team = relationship("Team", foreign_keys=[related_team_id])

    def __repr__(self):
        return f"<Notification(id={self.id}, user_id={self.user_id}, type={self.type}, is_read={self.is_read})>"
