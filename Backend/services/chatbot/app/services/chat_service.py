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
    print(f"[ensure_chathead] user_id={user_id}, chathead_id={chathead_id}, title={title}", file=sys.stderr)
    if chathead_id is not None:
        chat = chat_repo.get_chathead(db, chathead_id)
        print(f"[ensure_chathead] loaded chat: {chat}", file=sys.stderr)
        if chat is None:
            raise PermissionError("Chat not found")
        if chat.user_id != user_id:
            raise PermissionError("Access denied")
        return chat.id

    chat = chat_repo.create_chathead(db, user_id=user_id, title=title)
    db.flush()
    print(f"[ensure_chathead] created new chat id={chat.id}", file=sys.stderr)
    return chat.id

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
    print(f"[load_chat_history] Loading history for chathead_id={chathead_id}, limit={limit}", file=sys.stderr)
    
    # Get messages from repository
    messages = chat_repo.get_messages(db, chathead_id=chathead_id, limit=limit * 2)
    
    print(f"[load_chat_history] Loaded {len(messages)} messages from DB", file=sys.stderr)
    
    # Convert to LangChain format
    chat_history = []
    for msg in messages:
        # Use enum comparison instead of string comparison
        if msg.role == MessageRole.USER:
            chat_history.append(HumanMessage(content=msg.message))
            print(f"  [USER] {msg.message[:50]}...", file=sys.stderr)
        elif msg.role == MessageRole.ASSISTANT:
            chat_history.append(AIMessage(content=msg.message))
            print(f"  [ASST] {msg.message[:50]}...", file=sys.stderr)
    
    print(f"[load_chat_history] Converted to {len(chat_history)} LangChain messages", file=sys.stderr)
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
        print(f"[respond_turn] start user_id={user_id} chathead_id={chathead_id} docs={active_doc_ids}", file=sys.stderr)
        cid = ensure_chathead(db, user_id=user_id, chathead_id=chathead_id, title=title)

        # Load chat history BEFORE saving the new user message
        print("[respond_turn] loading chat history", file=sys.stderr)
        chat_history = load_chat_history(db, chathead_id=cid, limit=10)  # Last 10 exchanges
        print(chat_history)
        
        print("[respond_turn] saving user message", file=sys.stderr)
        # Pass MessageRole enum instead of string
        chat_repo.add_message(
            db, 
            chathead_id=cid, 
            role=MessageRole.USER,  # ← Use enum
            message=message, 
            active_doc_ids=active_doc_ids
        )

        print("[respond_turn] running agent", file=sys.stderr)
        agent = DocumentAgent(db, management_db)
        out = agent.get_response(
            active_doc_ids=active_doc_ids, 
            user_message=message,
            chat_history=chat_history  # ← Pass history to agent
        )
        print(f"[respond_turn] agent result keys={list(out.keys())}", file=sys.stderr)

        print("[respond_turn] saving assistant message", file=sys.stderr)
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
        print("[respond_turn] committed", file=sys.stderr)
        return {"chathead_id": cid, "answer": out["answer"]}

    except Exception:
        traceback.print_exc()
        raise