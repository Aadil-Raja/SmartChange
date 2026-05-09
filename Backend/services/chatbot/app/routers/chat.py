from fastapi import APIRouter, Depends, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.deps.db import get_db, get_management_db
from app.services import chat_service
from app.services import chat_service_v2
from app.services import summarizer_service
from app.repositories import chat_repo
from app.schemas import ChatTurnIn
from app.schemas.chat import ChatTurnOutV2
from app.utils.response_utils import make_response
from app.deps.auth import get_current_user
from app.core.config import get_settings
import sys

router = APIRouter()


@router.get("/config", status_code=status.HTTP_200_OK)
def get_chat_config():
    """Returns runtime chat configuration values (e.g. document selection limits)."""
    settings = get_settings()
    return make_response(True, "OK", data={"max_active_documents": settings.max_active_documents}, status_code=200)


@router.get("/quota", status_code=status.HTTP_200_OK)
def get_my_quota(
    db: Session = Depends(get_db),
    management_db: Session = Depends(get_management_db),
    user=Depends(get_current_user),
):
    """Returns the current user's token quota and usage. Serves from cache when fresh."""
    from shared.repos.token_quota_repo import peek_quota, get_current_usage
    from app.services import quota_cache
    from datetime import datetime, timezone, timedelta

    user_id = int(user)
    settings = get_settings()

    # Serve from cache if fresh
    cached = quota_cache.get(user_id)
    if cached:
        return make_response(True, "OK", data=cached, status_code=200)

    # Cache miss — hit DB (peek only, no auto-reset)
    quota = peek_quota(management_db, user_id)

    if not quota:
        # No row yet — show defaults, 0 used, no window started
        snapshot = {
            "token_limit": settings.default_token_limit,
            "tokens_used": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_remaining": settings.default_token_limit,
            "resets_at": None,
            "is_default": True,
        }
        quota_cache.set(user_id, snapshot)
        return make_response(True, "OK", data=snapshot, status_code=200)

    # Window not started yet (last_reset_at is NULL)
    if quota.last_reset_at is None:
        snapshot = {
            "token_limit": quota.token_limit,
            "tokens_used": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_remaining": quota.token_limit,
            "resets_at": None,
            "is_default": False,
        }
        quota_cache.set(user_id, snapshot)
        return make_response(True, "OK", data=snapshot, status_code=200)

    last_reset = quota.last_reset_at
    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    resets_at = last_reset + timedelta(hours=quota.reset_interval_hours)
    now = datetime.now(timezone.utc)

    # Window expired — show as reset (0 used) but don't touch DB
    # The actual reset happens on next message via _auto_reset_if_due
    if now >= resets_at:
        snapshot = {
            "token_limit": quota.token_limit,
            "tokens_used": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_remaining": quota.token_limit,
            "resets_at": None,
            "is_default": False,
            "window_expired": True,
        }
        # Don't cache this — next message will set the real new window
        return make_response(True, "OK", data=snapshot, status_code=200)

    usage = get_current_usage(management_db, user_id, quota.last_reset_at)
    snapshot = {
        "token_limit": quota.token_limit,
        "tokens_used": usage["total"],
        "tokens_input": usage["tokens_input"],
        "tokens_output": usage["tokens_output"],
        "tokens_remaining": max(0, quota.token_limit - usage["total"]),
        "resets_at": resets_at.isoformat(),
    }
    quota_cache.set(user_id, snapshot)
    return make_response(True, "OK", data=snapshot, status_code=200)

@router.post("/respond", status_code=status.HTTP_200_OK)
def respond_route(
    payload: ChatTurnIn,
    db: Session = Depends(get_db),
    management_db: Session = Depends(get_management_db),
    user=Depends(get_current_user),
):
    try:
        user_id = int(user)
        print(user_id)
        chathead_id = payload.chathead_id

        result = chat_service.respond_turn(
            db,
            management_db,
            user_id=user_id,
            chathead_id=chathead_id,
            active_doc_ids=payload.active_doc_ids,
            message=payload.message.strip(),
            title=payload.title,
        )
        return make_response(True, "OK", data=result, status_code=200)

    except chat_service_v2.QuotaExceededError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "message": "Token quota exceeded. Your limit resets soon.",
                "data": {"quota": e.quota_snapshot},
            }
        )

    except Exception as e:
        return make_response(False, "Could not process chat response", status_code=500, error=str(e))


@router.post("/respond-v2", status_code=status.HTTP_200_OK)
def respond_route_v2(
    payload: ChatTurnIn,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    management_db: Session = Depends(get_management_db),
    user=Depends(get_current_user),
):
    """
    V2 endpoint - returns structured response with citations.
    Response includes: chathead_id, answer, has_contradiction, citations[].
    Each citation has: doc_id, doc_title, page, section, snippet.
    
    Triggers background summarization every 10 messages.
    """
    try:
        user_id = int(user)
        chathead_id = payload.chathead_id

        result = chat_service_v2.respond_turn_v2(
            db,
            management_db,
            user_id=user_id,
            chathead_id=chathead_id,
            active_doc_ids=payload.active_doc_ids,
            message=payload.message.strip(),
            title=payload.title,
            reranker=payload.reranker or "fast",
        )
        
        # Check if should trigger summarization
        if summarizer_service.should_trigger_summarization(db, result["chathead_id"]):
            background_tasks.add_task(
                summarizer_service.update_summaries,
                db=db,
                management_db=management_db,
                chathead_id=result["chathead_id"],
                active_doc_ids=payload.active_doc_ids
            )
        
        return make_response(True, "OK", data=result, status_code=200)

    except chat_service_v2.QuotaExceededError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=429,
            content={
                "success": False,
                "message": "Token quota exceeded. Your limit resets soon.",
                "data": {"quota": e.quota_snapshot},
            }
        )

    except Exception as e:
        return make_response(False, "Could not process chat response", status_code=500, error=str(e))