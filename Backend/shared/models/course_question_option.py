from sqlalchemy import Column, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from .user import Base


class CourseQuestionOption(Base):
    __tablename__ = "course_question_options"

    id = Column(Integer, primary_key=True, index=True)
    question_detail_id = Column(
        Integer,
        ForeignKey("course_question_details.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    option_text = Column(Text, nullable=False)
    option_order = Column(Integer, nullable=False)  # 0, 1, 2, 3 for display order

    # Relationship
    question_detail = relationship("CourseQuestionDetail", back_populates="options")

    __table_args__ = (
        Index("ix_course_option_question_order", "question_detail_id", "option_order"),
    )