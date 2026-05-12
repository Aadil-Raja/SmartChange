from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .user import Base 
class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False, unique=True)
    description = Column(Text, nullable=True)
    department = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    thumbnail_public_id = Column(String, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Deadline configuration (in weeks)
    deadline_weeks = Column(Integer, nullable=True)  # NULL = no deadline

    # Relationships
    contents = relationship("ContentItem", back_populates="course", cascade="all, delete-orphan", passive_deletes=True)
    quizzes = relationship("CourseQuiz", back_populates="course", cascade="all, delete-orphan", passive_deletes=True)
    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan", passive_deletes=True)
