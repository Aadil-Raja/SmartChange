# app/services/chat_service_v2.py
"""
V2 chat service - returns structured response with citations.
"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from langchain_core.messages import HumanMessage, AIMessage

from app.repositories import chat_repo
from app.services.agent_service_v2 import DocumentAgentV2
from app.models import MessageRole
import sys
import traceback


def respond_turn_v2(
    db: Session,
    management_db: Session,
    *,
    user_id: int,
    chathead_id: int | None,
    active_doc_ids: List[int],
    message: str,
    title: str | None = None
) -> dict:
    """
    V2 respond turn - returns {chathead_id, answer, has_contradiction, citations}.
    Saves only the answer text to DB (citations are generated fresh each time).
    """
    try:
        print(f"[respond_turn_v2] user_id={user_id} chathead_id={chathead_id} docs={active_doc_ids}", file=sys.stderr)

        # Ensure chathead exists
        from app.services.chat_service import ensure_chathead, load_chat_history
        cid = ensure_chathead(db, user_id=user_id, chathead_id=chathead_id, title=title)

        # Load history before saving new message
        chat_history = load_chat_history(db, chathead_id=cid, limit=10)

        # Save user message
        chat_repo.add_message(
            db,
            chathead_id=cid,
            role=MessageRole.USER,
            message=message,
            active_doc_ids=active_doc_ids
        )

        # Run v2 agent
        agent = DocumentAgentV2(db, management_db)
        out = agent.get_response(
            active_doc_ids=active_doc_ids,
            user_message=message,
            chat_history=chat_history
        )

        answer_text = out["answer"]

        # Save only the answer text and citations to DB
        chat_repo.add_message(
            db,
            chathead_id=cid,
            role=MessageRole.ASSISTANT,
            message=answer_text,
            active_doc_ids=active_doc_ids,
            citations=out.get("citations", [])
        )

        chat = chat_repo.get_chathead(db, cid)
        chat.last_active_at = datetime.utcnow()
        db.add(chat)
        db.commit()
        db.refresh(chat)

        print(f"[respond_turn_v2] committed, citations={len(out.get('citations', []))}", file=sys.stderr)

        return {
            "chathead_id": cid,
            "answer": answer_text,
            "has_contradiction": out.get("has_contradiction", False),
            "citations": out.get("citations", [])
        }

    except Exception:
        traceback.print_exc()
        raise
