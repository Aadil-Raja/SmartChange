from sqlalchemy import Column, Integer, String, Enum, ForeignKey, Text, Index, UniqueConstraint
from sqlalchemy.orm import relationship
import enum
from .user import Base  # reuse your existing Base
from sqlalchemy import DateTime,func
class ContentType(enum.Enum):
    DOCUMENT = "document"
    VIDEO = "video"
    LINK = "link"

class ContentItem(Base):
    __tablename__ = "content_items"

    id = Column(Integer, primary_key=True)
    course_id = Column(Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(Enum(ContentType, name="content_type_t", create_type=True), nullable=False)

    document_id = Column(Integer, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    storage_url = Column(String, nullable=True)
    external_url = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course", back_populates="contents")
    document = relationship("Document", lazy="joined")

    __table_args__ = (
        # Removed order_index references
        Index("ix_content_course_created", "course_id", "created_at"),
        # Or use id instead of created_at:
        # Index("ix_content_course_id", "course_id", "id"),
    )
