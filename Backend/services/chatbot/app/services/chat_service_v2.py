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
from app.services.chat_logger import initialize_logger
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

        # Initialize logger for this chathead
        try:
            from app.services.chat_logger import initialize_logger, get_logger
            
            # Always initialize for new chathead, or if logger doesn't match current chathead
            should_init = False
            if chathead_id is None:  # New chathead
                should_init = True
            else:
                current_logger = get_logger()
                if current_logger is None or current_logger.chathead_id != cid:
                    should_init = True
            
            if should_init:
                initialize_logger(cid)
                print(f"[LOGGER] Initialized logger for chathead {cid}", file=sys.stderr)
        except Exception as e:
            print(f"[LOGGER] Failed to initialize: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)

        # Load document-wise histories (summaries + all unsummarized messages)
        doc_histories = load_doc_summaries_and_messages(
            db=db,
            management_db=management_db,
            chathead_id=cid,
            active_doc_ids=active_doc_ids
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
        tool_tokens_input = out.get("tokens_input", 0)
        tool_tokens_output = out.get("tokens_output", 0)

        from shared.llm.utils import count_tokens
        msg_tokens = count_tokens(message)
        tokens_input = msg_tokens + tool_tokens_input

        # Determine call_type — read from tool output if present, else infer
        tool_call_type = out.get("call_type", None)
        if tool_call_type in ("doc_qa", "list_sections", "section_summary"):
            call_type = tool_call_type
        elif tool_tokens_input == 0 and tool_tokens_output == 0 and not citations:
            call_type = "direct"
        elif tool_tokens_output == 0 and citations:
            call_type = "list_sections"
        elif tool_tokens_output == 0 and not citations:
            call_type = "section_summary"
        else:
            call_type = "doc_qa"

        # Count output tokens:
        # - list_sections: NO output (DB query, no LLM generation)
        # - section_summary cache hit: NO output (served from DB)
        # - doc_qa / section_summary cache miss / direct: YES count output
        if call_type in ("list_sections", "section_summary"):
            tokens_output = tool_tokens_output  # 0 for cache hit, real value for cache miss
        else:
            # direct or doc_qa — use tool output if present, else count answer text
            tokens_output = tool_tokens_output if tool_tokens_output > 0 else count_tokens(answer_text)

        # Log usage — always log if tokens were consumed, quota row optional
        try:
            from shared.repos.token_quota_repo import get_quota, log_usage
            from datetime import datetime, timezone
            from app.services import quota_cache
            quota = get_quota(management_db, user_id)
            if quota:
                window_start = quota.last_reset_at
            else:
                now = datetime.now(timezone.utc)
                window_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            log_usage(
                management_db,
                user_id=user_id,
                tokens_input=tokens_input,
                tokens_output=tokens_output,
                call_type=call_type,
                window_start=window_start,
            )
            # Update in-memory cache immediately — no extra DB query needed
            quota_cache.increment(user_id, tokens_input, tokens_output)
            # Build quota snapshot to return inline with the response
            cached = quota_cache.get(user_id)
            if not cached:
                # Cache miss — build from DB and store
                from shared.repos.token_quota_repo import get_current_usage
                usage = get_current_usage(management_db, user_id, window_start)
                if quota:
                    from datetime import timedelta
                    last_reset = quota.last_reset_at
                    if last_reset.tzinfo is None:
                        last_reset = last_reset.replace(tzinfo=timezone.utc)
                    resets_at = last_reset + timedelta(hours=quota.reset_interval_hours)
                    cached = {
                        "token_limit": quota.token_limit,
                        "tokens_used": usage["total"],
                        "tokens_input": usage["tokens_input"],
                        "tokens_output": usage["tokens_output"],
                        "tokens_remaining": max(0, quota.token_limit - usage["total"]),
                        "resets_at": resets_at.isoformat(),
                    }
                else:
                    cached = {
                        "token_limit": None,
                        "tokens_used": usage["total"],
                        "tokens_input": usage["tokens_input"],
                        "tokens_output": usage["tokens_output"],
                        "tokens_remaining": None,
                        "resets_at": None,
                    }
                quota_cache.set(user_id, cached)
            quota_snapshot = cached
        except Exception:
            traceback.print_exc()
            quota_snapshot = None

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
            "citations": out.get("citations", []),
            "quota": quota_snapshot,
        }

    except Exception:
        traceback.print_exc()
        raise
