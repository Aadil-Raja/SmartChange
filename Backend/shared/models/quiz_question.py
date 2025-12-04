from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from .user import Base


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(
        Integer,
        ForeignKey("quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    question_text = Column(Text, nullable=False)
    question_order = Column(Integer, nullable=False)  # for sorting (0, 1, 2, ...)
    correct_answer_index = Column(Integer, nullable=False)  # which option is correct (0-3)
    explanation = Column(Text, nullable=True)  # optional explanation for the correct answer
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    quiz = relationship("Quiz", back_populates="questions")
    options = relationship(
        "QuizOption",
        back_populates="question",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="QuizOption.option_order.asc()"
    )

    __table_args__ = (
        Index("ix_question_quiz_order", "quiz_id", "question_order"),
    )
