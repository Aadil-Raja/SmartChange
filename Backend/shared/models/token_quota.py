from sqlalchemy import Column, BigInteger, Integer, String, DateTime, ForeignKey, Index, func
from sqlalchemy.orm import relationship
from .user import Base


class UserTokenQuota(Base):
    """
    Per-user token quota set by admin.
    If no row exists for a user, fall back to env defaults.
    """
    __tablename__ = "user_token_quota"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    token_limit = Column(Integer, nullable=False)               # total tokens allowed per window
    reset_interval_hours = Column(Integer, nullable=False)      # e.g. 3, 24, 168
    last_reset_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", backref="token_quota")


class UserTokenUsage(Base):
    """
    One row per LLM call. window_start ties the row to a quota window.
    To get current usage: SUM where user_id=X AND window_start = quota.last_reset_at
    """
    __tablename__ = "user_token_usage"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tokens_input = Column(Integer, nullable=False, default=0)
    tokens_output = Column(Integer, nullable=False, default=0)
    call_type = Column(String(32), nullable=False)   # 'doc_qa' | 'list_sections' | 'section_summary'
    window_start = Column(DateTime(timezone=True), nullable=False)  # copied from quota.last_reset_at
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", backref="token_usage")

    __table_args__ = (
        Index("ix_token_usage_user_window", "user_id", "window_start"),
    )
