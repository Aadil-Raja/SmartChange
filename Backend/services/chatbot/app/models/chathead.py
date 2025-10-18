# services/chatbot/app/models/chathead.py
from datetime import datetime
from sqlalchemy import Column, BigInteger, String, DateTime, func
from sqlalchemy.orm import relationship
from .base import Base


class ChatHead(Base):
    __tablename__ = "chatheads"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(BigInteger, nullable=False, index=True)
    title = Column(String, nullable=True)  # user-defined chat name

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_active_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationship
    messages = relationship(
        "ChatMessage",
        back_populates="chathead",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )

    def __repr__(self):
        return f"<ChatHead id={self.id} user_id={self.user_id} title={self.title}>"
