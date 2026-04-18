# services/chatbot/app/repositories/chat_repo.py
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, any_
from app.models import ChatHead, ChatMessage, MessageRole, ChatSummary

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
    active_doc_ids: Optional[List[int]],
    citations: Optional[list] = None
) -> ChatMessage:
    msg = ChatMessage(
        chathead_id=chathead_id, 
        role=role,
        message=message, 
        active_doc_ids=active_doc_ids,
        citations=citations or []
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


# ============================================================================
# CHAT SUMMARY OPERATIONS
# ============================================================================

def get_summary(db: Session, chathead_id: int, doc_id: int) -> Optional[ChatSummary]:
    """Get summary for a specific chathead + doc combination."""
    return db.query(ChatSummary).filter(
        ChatSummary.chathead_id == chathead_id,
        ChatSummary.doc_id == doc_id
    ).first()


def get_all_summaries(db: Session, chathead_id: int) -> List[ChatSummary]:
    """Get all summaries for a chathead."""
    return db.query(ChatSummary).filter(
        ChatSummary.chathead_id == chathead_id
    ).all()


def upsert_summary(
    db: Session,
    chathead_id: int,
    doc_id: int,
    summary: str,
    last_summarized_message_id: int = None
) -> ChatSummary:
    """Insert or update summary for chathead + doc."""
    existing = get_summary(db, chathead_id, doc_id)
    if existing:
        existing.summary = summary
        existing.last_summarized_message_id = last_summarized_message_id
        existing.updated_at = func.now()
        db.flush()
        return existing
    else:
        new_summary = ChatSummary(
            chathead_id=chathead_id,
            doc_id=doc_id,
            summary=summary,
            last_summarized_message_id=last_summarized_message_id
        )
        db.add(new_summary)
        db.flush()
        return new_summary


# ============================================================================
# MESSAGE OPERATIONS FOR HISTORY
# ============================================================================

def get_last_n_messages_for_doc(
    db: Session,
    chathead_id: int,
    doc_id: int,
    n: int
) -> List[ChatMessage]:
    """
    Get last N messages where doc_id appears in active_doc_ids array.
    Returns messages in chronological order (oldest first).
    """
    messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.chathead_id == chathead_id,
            ChatMessage.active_doc_ids.any(doc_id)  # PostgreSQL array contains
        )
        .order_by(ChatMessage.created_at.desc())
        .limit(n)
        .all()
    )
    
    return list(reversed(messages))  # Chronological order


def get_all_messages_except_last_n(
    db: Session,
    chathead_id: int,
    exclude_last_n: int
) -> List[ChatMessage]:
    """
    Get all messages except the last N.
    Returns messages in chronological order.
    Used for summarization.
    """
    all_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chathead_id == chathead_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    if len(all_messages) <= exclude_last_n:
        return []
    
    return all_messages[:-exclude_last_n]


def get_all_messages(
    db: Session,
    chathead_id: int
) -> List[ChatMessage]:
    """
    Get all messages for a chathead.
    Returns messages in chronological order (oldest first).
    """
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.chathead_id == chathead_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    return messages


def get_messages_since_last_summary(
    db: Session,
    chathead_id: int,
    last_summarized_message_id: int,
    exclude_last_n: int
) -> List[ChatMessage]:
    """
    Get messages after last_summarized_message_id, excluding the last N messages.
    Returns messages in chronological order.
    Used for incremental summarization.
    """
    all_messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.chathead_id == chathead_id,
            ChatMessage.id > last_summarized_message_id
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    
    if len(all_messages) <= exclude_last_n:
        return []
    
    return all_messages[:-exclude_last_n]


def count_total_messages(db: Session, chathead_id: int) -> int:
    """Count total messages in chathead."""
    return db.query(func.count(ChatMessage.id)).filter(
        ChatMessage.chathead_id == chathead_id
    ).scalar()


def get_unsummarized_messages_for_doc(
    db: Session,
    chathead_id: int,
    doc_id: int,
    last_summarized_message_id: int = None
) -> List[ChatMessage]:
    """
    Get all messages that have NOT been summarized yet for a specific document.
    If last_summarized_message_id is provided, returns messages after that ID.
    Otherwise, returns all messages.
    Returns messages in chronological order (oldest first).
    """
    query = db.query(ChatMessage).filter(
        ChatMessage.chathead_id == chathead_id,
        ChatMessage.active_doc_ids.any(doc_id)
    )
    
    if last_summarized_message_id:
        query = query.filter(ChatMessage.id > last_summarized_message_id)
    
    messages = query.order_by(ChatMessage.created_at.asc()).all()
    
    return messages
