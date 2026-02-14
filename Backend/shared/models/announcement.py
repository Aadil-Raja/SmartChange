from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from .user import Base

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    related_course_id = Column(Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)

    team = relationship("Team")
    author = relationship("User")
    course = relationship("Course")
    comments = relationship(
        "AnnouncementComment",
        back_populates="announcement",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="AnnouncementComment.id.asc()",
    )
    attachments = relationship(
        "AnnouncementAttachment",
        back_populates="announcement",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("ix_ann_team_created", "team_id", "created_at"),
    )

class AnnouncementComment(Base):
    __tablename__ = "announcement_comments"

    id = Column(Integer, primary_key=True)
    announcement_id = Column(Integer, ForeignKey("announcements.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    announcement = relationship("Announcement", back_populates="comments")
    user = relationship("User")
