from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum, Index, func
from sqlalchemy.orm import relationship
import enum
from .user import Base


class QuizStatus(enum.Enum):
    GENERATING = "GENERATING"  # LLM is generating questions
    DRAFT = "DRAFT"            # Generated, admin can edit
    PUBLISHED = "PUBLISHED"    # Published, visible to employees
    ARCHIVED = "ARCHIVED"      # Hidden from employees


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    total_questions = Column(Integer, nullable=False, default=0)
    
    status = Column(
        Enum(QuizStatus, name="quiz_status", create_type=True),
        nullable=False,
        server_default=QuizStatus.DRAFT.value
    )
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    published_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships (no backref to avoid deletion issues)
    document = relationship("Document", lazy="joined")
    creator = relationship("User", lazy="joined")
    questions = relationship(
        "QuizQuestion",
        back_populates="quiz",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="QuizQuestion.question_order.asc()"
    )

    __table_args__ = (
        Index("ix_quiz_document_status", "document_id", "status"),
    )
