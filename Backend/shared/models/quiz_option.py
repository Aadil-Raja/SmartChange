from sqlalchemy import Column, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from .user import Base


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(
        Integer,
        ForeignKey("quiz_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    option_text = Column(Text, nullable=False)
    option_order = Column(Integer, nullable=False)  # 0, 1, 2, 3 for display order

    # Relationship
    question = relationship("QuizQuestion", back_populates="options")

    __table_args__ = (
        Index("ix_option_question_order", "question_id", "option_order"),
    )
