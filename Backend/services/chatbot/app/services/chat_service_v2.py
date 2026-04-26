# app/services/chat_service_v2.py
"""
V2 chat service - returns structured response with citations.
"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict
from langchain_core.messages import HumanMessage, AIMessage
from concurrent.futures import ThreadPoolExecutor

from app.repositories import chat_repo
from app.services.agent_service_v2 import DocumentAgentV2
from app.models import MessageRole
from app.services.chat_logger import initialize_logger
import sys
import traceback


class QuotaExceededError(Exception):
    """Raised when a user has exhausted their token quota for the current window."""
    def __init__(self, quota_snapshot: dict):
        self.quota_snapshot = quota_snapshot
        super().__init__("Token quota exceeded")


def _load_section_names_for_docs(management_db: Session, document_ids: List[int]) -> Dict[int, List[str]]:
    """
    Load section names for all documents in parallel.
    
    Args:
        management_db: Database session
        document_ids: List of document IDs
        
    Returns:
        Dict mapping doc_id to list of section names
    """
    from shared.models import DocumentSection
    
    def get_sections(doc_id):
        try:
            sections = management_db.query(DocumentSection.section_title).filter(
                DocumentSection.document_id == doc_id
            ).order_by(DocumentSection.start_chunk_index).all()
            return doc_id, [s[0] for s in sections if s[0]]
        except Exception as e:
            print(f"[SECTIONS] Error getting sections for doc {doc_id}: {e}", file=sys.stderr)
            return doc_id, []
    
    with ThreadPoolExecutor(max_workers=len(document_ids)) as executor:
        futures = [executor.submit(get_sections, doc_id) for doc_id in document_ids]
        results = [future.result() for future in futures]
    
    return dict(results)


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
        # ── Quota enforcement ──────────────────────────────────────────────
        from shared.repos.token_quota_repo import get_quota, get_current_usage
        from app.services import quota_cache
        from app.core.config import get_settings
        from datetime import datetime as dt, timezone, timedelta

        _settings = get_settings()
        _quota = get_quota(management_db, user_id)

        # Determine limit and window_start
        if _quota:
            _limit = _quota.token_limit
            _window_start = _quota.last_reset_at  # may be None if window not started yet
            _reset_hours = _quota.reset_interval_hours
        else:
            _limit = _settings.default_token_limit
            _now = dt.now(timezone.utc)
            _window_start = _now.replace(hour=0, minute=0, second=0, microsecond=0)
            _reset_hours = _settings.default_reset_interval_hours

        # Check cache first, fall back to DB
        _cached = quota_cache.get(user_id)
        if _cached:
            _used = _cached.get("tokens_used", 0)
        elif _window_start is None:
            _used = 0  # window not started yet, no usage possible
        else:
            _usage = get_current_usage(management_db, user_id, _window_start)
            _used = _usage["total"]

        if _used >= _limit:
            if _quota and _quota.last_reset_at:
                _last = _quota.last_reset_at
                if _last.tzinfo is None:
                    _last = _last.replace(tzinfo=timezone.utc)
                _resets_at = (_last + timedelta(hours=_reset_hours)).isoformat()
            else:
                _resets_at = None
            _snapshot = {
                "token_limit": _limit,
                "tokens_used": _used,
                "tokens_remaining": 0,
                "resets_at": _resets_at,
                "is_default": _quota is None,
            }
            raise QuotaExceededError(_snapshot)
        # ── End quota enforcement ──────────────────────────────────────────

        # Ensure chathead exists
        from app.services.chat_service import ensure_chathead, load_doc_summaries_and_messages
        from app.models.chathead import ChatHead
        
        cid = ensure_chathead(db, user_id=user_id, chathead_id=chathead_id, title=title)
        
        # Fetch the chathead object to access use_deep_reranker
        chathead_obj = db.query(ChatHead).filter(ChatHead.id == cid).first()

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

        # ✅ OPTIMIZATION: Load doc histories AND section names in parallel
        from concurrent.futures import ThreadPoolExecutor
        
        print(f"[CHAT] Loading doc histories and sections in parallel...", file=sys.stderr)
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Start both operations simultaneously
            doc_histories_future = executor.submit(
                load_doc_summaries_and_messages,
                db=db,
                management_db=management_db,
                chathead_id=cid,
                active_doc_ids=active_doc_ids
            )
            
            sections_future = executor.submit(
                _load_section_names_for_docs,
                management_db=management_db,
                document_ids=active_doc_ids
            )
            
            # Wait for both to complete
            doc_histories = doc_histories_future.result()
            section_names_map = sections_future.result()
        
        print(f"[CHAT] Loaded {len(doc_histories)} doc histories and {len(section_names_map)} section maps in parallel", file=sys.stderr)

        # Run v2 agent FIRST to get validated doc IDs
        agent = DocumentAgentV2(db, management_db, chathead_obj)  # Pass chathead
        out = agent.get_response(
            active_doc_ids=active_doc_ids,
            user_message=message,
            doc_histories=doc_histories,  # Pass document-wise histories
            section_names_map=section_names_map  # ✅ NEW: Pass pre-fetched sections
        )

        answer_text = out["answer"]
        citations = out.get("citations", [])
        tool_tokens_input = out.get("tokens_input", 0)
        tool_tokens_output = out.get("tokens_output", 0)

        print(f"[CHAT] Agent returned: tokens_input={tool_tokens_input}, tokens_output={tool_tokens_output}, call_type={out.get('call_type')}", file=sys.stderr)

        from shared.llm.utils import count_tokens
        msg_tokens = count_tokens(message)
        tokens_input = msg_tokens + tool_tokens_input
        print(f"[CHAT] Final token count: msg={msg_tokens} + tool={tool_tokens_input} = {tokens_input} input, {tool_tokens_output} output", file=sys.stderr)

        # Determine call_type — every tool sets this explicitly, trust it completely.
        # Only fall back to "doc_qa" if the agent somehow lost the field.
        tool_call_type = out.get("call_type") or ""
        if tool_call_type in ("doc_qa", "list_sections", "section_summary", "direct"):
            call_type = tool_call_type
        else:
            # Should never happen — all tools set call_type. Default to doc_qa.
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
            from shared.repos.token_quota_repo import get_quota, log_usage, upsert_quota
            from datetime import datetime as dt, timezone
            from app.services import quota_cache
            quota = get_quota(management_db, user_id)
            is_default_quota = False
            if not quota:
                # No row at all — auto-create with defaults, window starts now
                quota = upsert_quota(
                    management_db,
                    user_id=user_id,
                    token_limit=_settings.default_token_limit,
                    reset_interval_hours=_settings.default_reset_interval_hours,
                )
                is_default_quota = True

            if quota.last_reset_at is None:
                # Admin set a custom quota but user hasn't messaged yet — start window now
                quota.last_reset_at = dt.now(timezone.utc).replace(tzinfo=None)
                quota.updated_at = dt.now(timezone.utc).replace(tzinfo=None)
                management_db.commit()
                management_db.refresh(quota)
                # Invalidate stale cache (had resets_at=None) so snapshot is rebuilt fresh
                quota_cache.invalidate(user_id)

            window_start = quota.last_reset_at
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
                from datetime import timedelta
                usage = get_current_usage(management_db, user_id, window_start)
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
                    "is_default": is_default_quota,
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
        
        # NOW save BOTH user and assistant messages
        # User message: save the ORIGINAL active_doc_ids (what user had selected)
        # Assistant message: save validated_doc_ids (docs LLM actually cited)
        chat_repo.add_message(
            db,
            chathead_id=cid,
            role=MessageRole.USER,
            message=message,
            active_doc_ids=active_doc_ids  # Full selection the user had open
        )
        
        chat_repo.add_message(
            db,
            chathead_id=cid,
            role=MessageRole.ASSISTANT,
            message=answer_text,
            active_doc_ids=validated_doc_ids,  # Only docs actually cited
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
