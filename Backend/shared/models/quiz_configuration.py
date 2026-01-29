from sqlalchemy import Column, Integer, ForeignKey, DECIMAL, DateTime, func
from sqlalchemy.orm import relationship
from .user import Base


class QuizConfiguration(Base):
    __tablename__ = "quiz_configurations"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("course_quizzes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Core configuration settings
    max_attempts = Column(Integer, nullable=False, default=3)
    passing_score = Column(DECIMAL(5, 2), nullable=False, default=70.0)
    cooldown_minutes = Column(Integer, nullable=False, default=30)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    quiz = relationship("CourseQuiz", back_populates="configuration")
    creator = relationship("User")

    def __repr__(self):
        return f"<QuizConfiguration(quiz_id={self.quiz_id}, max_attempts={self.max_attempts}, passing_score={self.passing_score})>"