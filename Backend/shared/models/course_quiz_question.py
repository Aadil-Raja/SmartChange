from sqlalchemy import Column, Integer, DateTime, ForeignKey, Index, func, Enum, CheckConstraint
from sqlalchemy.orm import relationship
import enum
from .user import Base


class QuestionType(enum.Enum):
    REFERENCED = "REFERENCED"      # Points to document quiz question
    COURSE_SPECIFIC = "COURSE_SPECIFIC"  # Full question data stored in CourseQuestionDetail


class CourseQuizQuestion(Base):
    __tablename__ = "course_quiz_questions"

    id = Column(Integer, primary_key=True, index=True)
    course_quiz_id = Column(
        Integer,
        ForeignKey("course_quizzes.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    question_order = Column(Integer, nullable=False)  # for sorting (0, 1, 2, ...)
    question_type = Column(
        Enum(QuestionType, name="course_question_type", create_type=True),
        nullable=False
    )
    
    # For REFERENCED questions - points to document quiz question
    source_document_question_id = Column(
        Integer,
        ForeignKey("quiz_questions.id"),
        nullable=True,
        index=True
    )
    
    # For COURSE_SPECIFIC questions - points to course-specific question details
    course_question_detail_id = Column(
        Integer,
        ForeignKey("course_question_details.id"),
        nullable=True,
        index=True
    )
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    course_quiz = relationship("CourseQuiz", back_populates="questions")
    source_document_question = relationship("QuizQuestion", lazy="joined")
    course_question_detail = relationship("CourseQuestionDetail", lazy="joined")

    __table_args__ = (
        CheckConstraint(
            '(source_document_question_id IS NOT NULL AND course_question_detail_id IS NULL) OR '
            '(source_document_question_id IS NULL AND course_question_detail_id IS NOT NULL)',
            name='question_has_one_source'
        ),
        Index("ix_course_quiz_question_order", "course_quiz_id", "question_order"),
    )