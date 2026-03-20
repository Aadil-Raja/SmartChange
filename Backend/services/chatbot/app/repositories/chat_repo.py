# services/chatbot/app/repositories/chat_repo.py
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.models import ChatHead, ChatMessage, MessageRole

def create_chathead(db: Session, *, user_id: int, title: Optional[str]) -> ChatHead:
    chat = ChatHead(user_id=user_id, title=title or None)
    db.add(chat)
    db.flush()  # get chat.id
    return chat

def get_chathead(db: Session, chathead_id: int) -> Optional[ChatHead]:
    return db.query(ChatHead).filter(ChatHead.id == chathead_id).first()

def add_message(
    db: Session, 
    *, 
    chathead_id: int, 
    role: MessageRole,
    message: str, 
    active_doc_ids: Optional[List[int]]
) -> ChatMessage:
    """
    Add a message to a chathead.
    
    Args:
        db: Database session
        chathead_id: ID of the chathead
        role: MessageRole enum (USER or ASSISTANT)
        message: Content of the message
        active_doc_ids: Optional list of document IDs
    
    Returns:
        Created ChatMessage object
    """
    msg = ChatMessage(
        chathead_id=chathead_id, 
        role=role,
        message=message, 
        active_doc_ids=active_doc_ids
    )
    db.add(msg)
    db.flush()
    return msg


def get_messages(db: Session, *, chathead_id: int, limit: int = 20) -> List[ChatMessage]:
    """
    Get messages for a chathead, ordered by creation time (oldest first).
    
    Args:
        db: Database session
        chathead_id: ID of the chathead
        limit: Maximum number of messages to return
    
    Returns:
        List of ChatMessage objects with role as MessageRole enum
    """
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chathead_id == chathead_id)
        .order_by(ChatMessage.created_at.asc())  # Oldest first for chronological order
        .limit(limit)
        .all()
    )
    
    return messages


def list_chatheads(db: Session, *, user_id: int, limit: int, offset: int) -> Tuple[List[ChatHead], int]:
    """
    Return chatheads for a user, ordered by last active (newest first).
    """
    query = (
        db.query(ChatHead)
        .filter(ChatHead.user_id == user_id)
        .order_by(desc(ChatHead.last_active_at))
        .limit(limit)
        .offset(offset)
    )
    rows = query.all()
    
    total = db.query(func.count(ChatHead.id)).filter(ChatHead.user_id == user_id).scalar()
  
    return rows, total

def get_messages_window(
    db: Session, 
    *, 
    chathead_id: int, 
    limit: int, 
    before_id: int | None, 
    after_id: int | None
) -> List[ChatMessage]:
    """
    Get a window of messages with optional before/after pagination.
    """
    query = db.query(ChatMessage).filter(ChatMessage.chathead_id == chathead_id)

    if before_id:
        query = query.filter(ChatMessage.id < before_id)
    if after_id:
        query = query.filter(ChatMessage.id > after_id)

    query = query.order_by(desc(ChatMessage.id)).limit(limit)
    rows = query.all()
    
    return list(reversed(rows))