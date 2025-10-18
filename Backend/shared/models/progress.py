# shared/models/progress.py
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .user import Base

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content_id = Column(Integer, ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False)

    progress = Column(Float, nullable=False, server_default="0")  # 0..100
    completed_at = Column(DateTime(timezone=True), nullable=True)
    last_viewed_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "content_id", name="uq_user_content"),
    )

    # relationships (optional, for joined queries)
    content = relationship("ContentItem", lazy="joined")
