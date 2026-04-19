from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta

from app.deps.db import get_db
from app.deps.auth import get_current_admin
from app.core.config import get_settings
from app.utils.response_utils import make_response
from shared.repos.token_quota_repo import (
    get_quota, upsert_quota, reset_quota, get_current_usage
)

router = APIRouter()
settings = get_settings()


class QuotaSetIn(BaseModel):
    token_limit: int = Field(..., gt=0)
    reset_interval_hours: int = Field(..., gt=0)


def _quota_response(quota, usage: dict) -> dict:
    now = datetime.now(timezone.utc)
    last_reset = quota.last_reset_at
    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    resets_at = last_reset + timedelta(hours=quota.reset_interval_hours)
    return {
        "user_id": quota.user_id,
        "token_limit": quota.token_limit,
        "reset_interval_hours": quota.reset_interval_hours,
        "last_reset_at": last_reset.isoformat(),
        "resets_at": resets_at.isoformat(),
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
    quota = get_quota(db, user_id)
    if not quota:
        # No quota row — query today's daily bucket (same window used when logging without quota)
        from datetime import datetime, timezone
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
    usage = get_current_usage(db, user_id, quota.last_reset_at)
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
    return make_response(True, "Quota reset", data={"user_id": user_id, "last_reset_at": quota.last_reset_at.isoformat()}, status_code=200)
