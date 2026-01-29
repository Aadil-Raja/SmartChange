from sqlalchemy import Column, Integer, ForeignKey, DateTime, Boolean, DECIMAL, JSON, func
from sqlalchemy.orm import relationship
from .user import Base


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    quiz_id = Column(Integer, ForeignKey("course_quizzes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Answer data stored as JSON: {"question_id": selected_option_index}
    # Example: {"10": 1, "11": 0, "12": 2}
    answers = Column(JSON, nullable=False)
    
    # Scoring results
    score = Column(Integer, nullable=False)  # Number of correct answers
    total_questions = Column(Integer, nullable=False)
    percentage = Column(DECIMAL(5, 2), nullable=False)  # 0.00 to 100.00
    passed = Column(Boolean, nullable=False, default=False)
    
    # Timestamps
    completed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User")
    quiz = relationship("CourseQuiz")

    def __repr__(self):
        return f"<QuizAttempt(id={self.id}, user_id={self.user_id}, quiz_id={self.quiz_id}, score={self.score}/{self.total_questions})>"