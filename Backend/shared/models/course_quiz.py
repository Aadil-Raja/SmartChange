from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Index, func, JSON
from sqlalchemy.orm import relationship
import enum
from .user import Base


class QuizStatus(enum.Enum):
    GENERATING = "GENERATING"  # LLM is generating questions
    DRAFT = "DRAFT"            # Generated, admin can edit
    PUBLISHED = "PUBLISHED"    # Published, visible to employees
    ARCHIVED = "ARCHIVED"      # Hidden from employees


class CourseQuiz(Base):
    __tablename__ = "course_quizzes"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    total_questions = Column(Integer, nullable=False, default=0)
    prerequisite_content_ids = Column(JSON, nullable=False, default=list)
    
    status = Column(
        Enum(QuizStatus, name="course_quiz_status", create_type=True),
        nullable=False,
        server_default=QuizStatus.DRAFT.value
    )
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    course = relationship("Course", back_populates="quizzes")
    creator = relationship("User", lazy="joined")
    questions = relationship(
        "CourseQuizQuestion",
        back_populates="course_quiz",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="CourseQuizQuestion.question_order.asc()"
    )

    __table_args__ = (
        Index("ix_course_quiz_status", "status"),
        Index("ix_course_quiz_course", "course_id"),
    )