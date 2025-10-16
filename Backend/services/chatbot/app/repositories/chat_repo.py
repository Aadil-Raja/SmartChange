# services/chatbot/app/repositories/chat_repo.py
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.models import ChatHead, ChatMessage

def create_chathead(db: Session, *, user_id: int, title: Optional[str]) -> ChatHead:
    chat = ChatHead(user_id=user_id, title=title or None)
    db.add(chat)
    db.flush()  # get chat.id
    return chat

def get_chathead(db: Session, chathead_id: int) -> Optional[ChatHead]:
    return db.get(ChatHead, chathead_id)

def add_message(db: Session, *, chathead_id: int, role: str, message: str, active_doc_id: Optional[int]) -> ChatMessage:
    msg = ChatMessage(chathead_id=chathead_id, role=role, message=message, active_doc_id=active_doc_id)
    db.add(msg)
    db.flush()
    return msg

def get_last_messages(db: Session, *, chathead_id: int, limit: int = 10):
    stmt = select(ChatMessage).where(ChatMessage.chathead_id == chathead_id).order_by(desc(ChatMessage.created_at)).limit(limit)
    return list(reversed(db.execute(stmt).scalars().all()))
