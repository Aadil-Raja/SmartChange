# services/chatbot/app/models/chat_summary.py
from datetime import datetime
from sqlalchemy import Column, BigInteger, Text, DateTime, ForeignKey, UniqueConstraint, func
from .base import Base


class ChatSummary(Base):
    """
    Stores conversation summaries per document.
    One summary per (chathead, document) combination.
    """
    __tablename__ = "chat_summaries"
    __table_args__ = (
        UniqueConstraint("chathead_id", "doc_id", name="uq_chathead_doc"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    chathead_id = Column(BigInteger, ForeignKey("chatheads.id", ondelete="CASCADE"), nullable=False)
    doc_id = Column(BigInteger, nullable=False, index=True)  # No FK - different database
    summary = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<ChatSummary chathead={self.chathead_id} doc={self.doc_id}>"
