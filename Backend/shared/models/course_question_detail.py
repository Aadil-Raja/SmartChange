from sqlalchemy import Column, Integer, Text, DateTime, func
from sqlalchemy.orm import relationship
from .user import Base


class CourseQuestionDetail(Base):
    __tablename__ = "course_question_details"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(Text, nullable=False)
    correct_answer_index = Column(Integer, nullable=False)  # which option is correct (0-3)
    explanation = Column(Text, nullable=True)  # optional explanation for the correct answer
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    options = relationship(
        "CourseQuestionOption",
        back_populates="question_detail",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CourseQuestionOption.option_order.asc()"
    )