# services/chatbot/app/models/chatmessage.py
from datetime import datetime
import enum
from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Text,
    DateTime,
    Enum,
    func,
    Index,
    ForeignKey,
    ARRAY,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from .base import Base


# ---------- Enum for message role ----------
class MessageRole(enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"


class ChatMessage(Base):
    __tablename__ = "chatmessages"
    __table_args__ = (
        Index("ix_msg_chathead_created", "chathead_id", "created_at"),
    )

    id = Column(BigInteger, primary_key=True, index=True)
    chathead_id = Column(BigInteger, ForeignKey("chatheads.id", ondelete="CASCADE"), nullable=False)
    
    role = Column(
        Enum(MessageRole, name="message_role", create_type=True),
        nullable=False,
    )
    
    message = Column(Text, nullable=False)
    active_doc_ids = Column(ARRAY(BigInteger), nullable=True, index=True)
    citations = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationship
    chathead = relationship("ChatHead", back_populates="messages")

    def __repr__(self):
        return f"<ChatMessage id={self.id} chathead_id={self.chathead_id} role={self.role.value}>"