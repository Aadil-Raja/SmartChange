from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta

from app.deps.db import get_db
from app.deps.auth import get_current_admin
from app.core.config import get_settings
from app.utils.response_utils import make_response
from shared.repos.token_quota_repo import (
    get_quota, peek_quota, upsert_quota, reset_quota, get_current_usage,
    get_usage_history, get_usage_overview, get_top_users_by_usage
)

router = APIRouter()
settings = get_settings()


def _invalidate_chatbot_cache(user_id: int):
    try:
        import requests
        url = f"{settings.chatbot_service_url}/internal/quota/invalidate/{user_id}"
        requests.post(url, timeout=2.0)
    except Exception:
        pass


class QuotaSetIn(BaseModel):
    token_limit: int = Field(..., gt=0)
    reset_interval_hours: int = Field(..., gt=0)


def _quota_response(quota, usage: dict) -> dict:
    if quota.last_reset_at:
        last_reset = quota.last_reset_at
        if last_reset.tzinfo is None:
            last_reset = last_reset.replace(tzinfo=timezone.utc)
        resets_at = (last_reset + timedelta(hours=quota.reset_interval_hours)).isoformat()
        last_reset_str = last_reset.isoformat()
    else:
        resets_at = None
        last_reset_str = None
    return {
        "user_id": quota.user_id,
        "token_limit": quota.token_limit,
        "reset_interval_hours": quota.reset_interval_hours,
        "last_reset_at": last_reset_str,
        "resets_at": resets_at,
        "tokens_used": usage["total"],
        "tokens_input": usage["tokens_input"],
        "tokens_output": usage["tokens_output"],
        "tokens_remaining": max(0, quota.token_limit - usage["total"]),
    }


@router.get("/users/{user_id}/quota")
def get_user_quota(
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    quota = peek_quota(db, user_id)
    if not quota:
        now = datetime.now(timezone.utc)
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        usage = get_current_usage(db, user_id, today)
        return make_response(True, "OK", data={
            "user_id": user_id,
            "token_limit": settings.default_token_limit,
            "reset_interval_hours": settings.default_reset_interval_hours,
            "tokens_used": usage["total"],
            "tokens_input": usage["tokens_input"],
            "tokens_output": usage["tokens_output"],
            "tokens_remaining": settings.default_token_limit - usage["total"],
            "note": "Using system defaults — no custom quota set yet",
        }, status_code=200)

    # quota exists but window not started yet (last_reset_at is NULL)
    if quota.last_reset_at is None:
        usage = {"total": 0, "tokens_input": 0, "tokens_output": 0}
        return make_response(True, "OK", data=_quota_response(quota, usage), status_code=200)

    # Check if window has expired — show as reset, don't touch DB
    last_reset = quota.last_reset_at
    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    resets_at = last_reset + timedelta(hours=quota.reset_interval_hours)
    if datetime.now(timezone.utc) >= resets_at:
        usage = {"total": 0, "tokens_input": 0, "tokens_output": 0}
        # Return with null resets_at so admin sees "Not set yet" — window starts on next message
        return make_response(True, "OK", data={
            "user_id": quota.user_id,
            "token_limit": quota.token_limit,
            "reset_interval_hours": quota.reset_interval_hours,
            "last_reset_at": None,
            "resets_at": None,
            "tokens_used": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_remaining": quota.token_limit,
            "note": "Window expired — resets on next message",
        }, status_code=200)

    usage = get_current_usage(db, user_id, quota.last_reset_at)
    return make_response(True, "OK", data=_quota_response(quota, usage), status_code=200)


@router.put("/users/{user_id}/quota")
def set_user_quota(
    user_id: int,
    payload: QuotaSetIn,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    quota = upsert_quota(
        db,
        user_id=user_id,
        token_limit=payload.token_limit,
        reset_interval_hours=payload.reset_interval_hours,
    )
    usage = get_current_usage(db, user_id, quota.last_reset_at) if quota.last_reset_at else {"total": 0, "tokens_input": 0, "tokens_output": 0}
    _invalidate_chatbot_cache(user_id)
    return make_response(True, "Quota updated", data=_quota_response(quota, usage), status_code=200)


@router.post("/users/{user_id}/quota/reset")
def reset_user_quota(
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    quota = reset_quota(db, user_id)
    if not quota:
        raise HTTPException(404, "No quota found for this user. Set one first via PUT.")
    _invalidate_chatbot_cache(user_id)
    return make_response(True, "Quota reset — window will start on next message", data={
        "user_id": user_id,
        "last_reset_at": None,
        "tokens_used": 0,
        "tokens_remaining": quota.token_limit,
    }, status_code=200)


@router.get("/users/{user_id}/quota/history")
def get_quota_history(
    user_id: int,
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    history = get_usage_history(db, user_id, days)
    total = sum(d["total"] for d in history)
    peak = max((d["total"] for d in history), default=0)
    active_days = sum(1 for d in history if d["total"] > 0)
    return make_response(True, "OK", data={
        "user_id": user_id,
        "days": days,
        "history": history,
        "summary": {"total": total, "peak": peak, "active_days": active_days},
    }, status_code=200)


@router.get("/quota/overview")
def get_overview(
    days: int = Query(default=7, ge=1, le=30),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Org-wide token usage stats for the last N days."""
    data = get_usage_overview(db, days)
    return make_response(True, "OK", data=data, status_code=200)


@router.get("/quota/top-users")
def get_top_users(
    days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=10, ge=1, le=20),
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """Top N users by token usage in the last N days. Max limit=20."""
    from shared.models.user import User
    rows = get_top_users_by_usage(db, days, limit)
    # Enrich with user names/emails
    if rows:
        user_ids = [r["user_id"] for r in rows]
        users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
        for r in rows:
            u = users.get(r["user_id"])
            r["name"] = u.Name if u else None
            r["email"] = u.email if u else None
    return make_response(True, "OK", data={"days": days, "limit": limit, "users": rows}, status_code=200)
