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
        # Ensure chathead exists
        from app.services.chat_service import ensure_chathead, load_doc_summaries_and_messages
        cid = ensure_chathead(db, user_id=user_id, chathead_id=chathead_id, title=title)

        # Load document-wise histories (summaries + last N messages)
        doc_histories = load_doc_summaries_and_messages(
            db=db,
            management_db=management_db,
            chathead_id=cid,
            active_doc_ids=active_doc_ids,
            n=5  # Last 5 messages verbatim
        )

        # Run v2 agent FIRST to get validated doc IDs
        agent = DocumentAgentV2(db, management_db)
        out = agent.get_response(
            active_doc_ids=active_doc_ids,
            user_message=message,
            doc_histories=doc_histories  # Pass document-wise histories
        )

        answer_text = out["answer"]
        citations = out.get("citations", [])

        # Extract validated doc IDs from citations (docs that LLM actually used)
        validated_doc_ids = []
        if citations:
            # Citations are grouped by doc: [{doc_id, doc_title, references: [...]}]
            validated_doc_ids = list(set([c["doc_id"] for c in citations if "doc_id" in c]))
        
        # If no citations, fall back to active_doc_ids (edge case)
        if not validated_doc_ids:
            validated_doc_ids = active_doc_ids
        
        # NOW save BOTH user and assistant messages with VALIDATED doc IDs only
        chat_repo.add_message(
            db,
            chathead_id=cid,
            role=MessageRole.USER,
            message=message,
            active_doc_ids=validated_doc_ids  # Only validated docs
        )
        
        chat_repo.add_message(
            db,
            chathead_id=cid,
            role=MessageRole.ASSISTANT,
            message=answer_text,
            active_doc_ids=validated_doc_ids,  # Only docs that were actually used
            citations=citations
        )

        chat = chat_repo.get_chathead(db, cid)
        chat.last_active_at = datetime.utcnow()
        db.add(chat)
        db.commit()
        db.refresh(chat)

        return {
            "chathead_id": cid,
            "answer": answer_text,
            "has_contradiction": out.get("has_contradiction", False),
            "citations": out.get("citations", [])
        }

    except Exception:
        traceback.print_exc()
        raise
