# services/chatbot/app/models/chatmessage.py
from datetime import datetime
from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    DateTime,
    func,
    CheckConstraint,
    Index,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from .base import Base


class ChatMessage(Base):
    __tablename__ = "chatmessages"
    __table_args__ = (
        CheckConstraint("role IN ('user','assistant')", name="ck_role_valid"),
        Index("ix_msg_chathead_created", "chathead_id", "created_at"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    chathead_id = Column(BigInteger, ForeignKey("chatheads.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    message = Column(Text, nullable=False)
    active_doc_id = Column(BigInteger, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    chathead = relationship("ChatHead", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage id={self.id} chathead_id={self.chathead_id} role={self.role}>"
