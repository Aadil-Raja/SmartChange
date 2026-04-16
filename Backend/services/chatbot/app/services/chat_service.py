# app/services/chat_service.py
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from langchain_core.messages import HumanMessage, AIMessage
from app.repositories import chat_repo
from app.services.agent_service import DocumentAgent
from app.models import MessageRole  # ← Import the enum
import sys, traceback

def ensure_chathead(db: Session, *, user_id: int, chathead_id: int | None, title: str | None) -> int:
    if chathead_id is not None:
        chat = chat_repo.get_chathead(db, chathead_id)
        if chat is None:
            raise PermissionError("Chat not found")
        if chat.user_id != user_id:
            raise PermissionError("Access denied")
        return chat.id

    chat = chat_repo.create_chathead(db, user_id=user_id, title=title)
    db.flush()
    return chat.id

def load_doc_summaries_and_messages(
    db: Session,
    management_db: Session,
    chathead_id: int,
    active_doc_ids: List[int],
    n: int = 5
) -> dict:
    """
    Load per-document summaries and last N messages.
    
    Args:
        db: Chatbot database session
        management_db: Management database session
        chathead_id: Chat ID
        active_doc_ids: List of active document IDs
        n: Number of recent messages to keep verbatim (default 5)
    
    Returns:
        Dict[doc_id, {doc_title, summary, last_n_messages}]
    """
    from shared.repos import documents_repo
    
    doc_histories = {}
    
    for doc_id in active_doc_ids:
        # Get summary
        summary_obj = chat_repo.get_summary(db, chathead_id, doc_id)
        summary = summary_obj.summary if summary_obj else None
        
        # Get last N messages for this doc
        last_n_messages = chat_repo.get_last_n_messages_for_doc(db, chathead_id, doc_id, n)
        
        # Get doc title
        doc = documents_repo.get_by_id(management_db, doc_id)
        doc_title = doc.title if doc else f"Document {doc_id}"
        
        doc_histories[doc_id] = {
            "doc_title": doc_title,
            "summary": summary,
            "last_n_messages": last_n_messages
        }
    
    return doc_histories


def load_chat_history(db: Session, chathead_id: int, limit: int = 10):
    """
    Load recent chat history and convert to LangChain message format.
    
    Args:
        db: Database session
        chathead_id: ID of the chathead
        limit: Maximum number of message pairs to load (default 10 = 20 messages)
    
    Returns:
        List of LangChain messages (HumanMessage and AIMessage objects)
    """
    # Get messages from repository
    messages = chat_repo.get_messages(db, chathead_id=chathead_id, limit=limit * 2)
    
    # Convert to LangChain format
    chat_history = []
    for msg in messages:
        # Use enum comparison instead of string comparison
        if msg.role == MessageRole.USER:
            chat_history.append(HumanMessage(content=msg.message))
        elif msg.role == MessageRole.ASSISTANT:
            chat_history.append(AIMessage(content=msg.message))
    
    return chat_history

def respond_turn(
    db: Session,
    management_db: Session,
    *,
    user_id: int,
    chathead_id: int | None,
    active_doc_ids: List[int],
    message: str,
    title: str | None = None
) -> dict:
    try:
        cid = ensure_chathead(db, user_id=user_id, chathead_id=chathead_id, title=title)

        # Load chat history BEFORE saving the new user message
        chat_history = load_chat_history(db, chathead_id=cid, limit=10)  # Last 10 exchanges
        
        # Pass MessageRole enum instead of string
        chat_repo.add_message(
            db, 
            chathead_id=cid, 
            role=MessageRole.USER,  # ← Use enum
            message=message, 
            active_doc_ids=active_doc_ids
        )

        agent = DocumentAgent(db, management_db)
        out = agent.get_response(
            active_doc_ids=active_doc_ids, 
            user_message=message,
            chat_history=chat_history  # ← Pass history to agent
        )

        # Pass MessageRole enum instead of string
        chat_repo.add_message(
            db, 
            chathead_id=cid, 
            role=MessageRole.ASSISTANT,  # ← Use enum
            message=out["answer"], 
            active_doc_ids=active_doc_ids
        )

        chat = chat_repo.get_chathead(db, cid)
        chat.last_active_at = datetime.utcnow()
        db.add(chat)

        # ✅ One commit only
        db.commit()
        db.refresh(chat)
        return {"chathead_id": cid, "answer": out["answer"]}

    except Exception:
        traceback.print_exc()
        raise