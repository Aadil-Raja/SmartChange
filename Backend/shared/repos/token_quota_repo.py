"""
Repository for user token quota and usage tracking.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from shared.models.token_quota import UserTokenQuota, UserTokenUsage


# ── Quota ──────────────────────────────────────────────────────────────────

def get_quota(db: Session, user_id: int) -> Optional[UserTokenQuota]:
    quota = db.query(UserTokenQuota).filter(UserTokenQuota.user_id == user_id).first()
    if quota:
        quota = _auto_reset_if_due(db, quota)
    return quota


def _auto_reset_if_due(db: Session, quota: UserTokenQuota) -> UserTokenQuota:
    """Check if the reset interval has elapsed and reset the window if so."""
    if quota.last_reset_at is None:
        return quota  # Window hasn't started yet — first message will start it
    now = datetime.now(timezone.utc)
    last_reset = quota.last_reset_at
    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)
    due_at = last_reset + timedelta(hours=quota.reset_interval_hours)
    if now >= due_at:
        quota.last_reset_at = now.replace(tzinfo=None)
        quota.updated_at = now.replace(tzinfo=None)
        db.commit()
        db.refresh(quota)
        try:
            from app.services import quota_cache
            quota_cache.invalidate(quota.user_id)
        except ImportError:
            pass
    return quota


def upsert_quota(
    db: Session,
    user_id: int,
    token_limit: int,
    reset_interval_hours: int,
    window_start: datetime | None = None,
) -> UserTokenQuota:
    quota = get_quota(db, user_id)
    if quota:
        # Update limit and interval only — never touch last_reset_at here
        quota.token_limit = token_limit
        quota.reset_interval_hours = reset_interval_hours
        quota.updated_at = datetime.now(timezone.utc)
    else:
        # window_start=None means "wait for first message to start the window"
        start = None
        if window_start is not None:
            start = window_start
            if start.tzinfo is not None:
                start = start.astimezone(timezone.utc).replace(tzinfo=None)
        quota = UserTokenQuota(
            user_id=user_id,
            token_limit=token_limit,
            reset_interval_hours=reset_interval_hours,
            last_reset_at=start,  # NULL until first message
        )
        db.add(quota)
    db.commit()
    db.refresh(quota)
    return quota


def reset_quota(db: Session, user_id: int) -> Optional[UserTokenQuota]:
    """Admin-triggered manual reset — moves the window start to now."""
    quota = get_quota(db, user_id)
    if not quota:
        return None
    quota.last_reset_at = datetime.now(timezone.utc)
    quota.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(quota)
    return quota


# ── Usage ──────────────────────────────────────────────────────────────────

def log_usage(
    db: Session,
    user_id: int,
    tokens_input: int,
    tokens_output: int,
    call_type: str,
    window_start: datetime,
) -> UserTokenUsage:
    # Normalize to naive UTC to match get_current_usage comparison
    if window_start.tzinfo is not None:
        window_start = window_start.astimezone(timezone.utc).replace(tzinfo=None)
    row = UserTokenUsage(
        user_id=user_id,
        tokens_input=tokens_input,
        tokens_output=tokens_output,
        call_type=call_type,
        window_start=window_start,
    )
    db.add(row)
    db.commit()
    return row


def get_current_usage(db: Session, user_id: int, window_start: datetime) -> dict:
    """Returns summed input + output tokens for the current window."""
    if window_start is None:
        return {"tokens_input": 0, "tokens_output": 0, "total": 0}
    # Normalize to naive UTC — Postgres stores timestamptz, psycopg2 may return naive or aware
    if window_start.tzinfo is not None:
        window_start = window_start.astimezone(timezone.utc).replace(tzinfo=None)

    result = db.query(
        func.coalesce(func.sum(UserTokenUsage.tokens_input), 0).label("total_input"),
        func.coalesce(func.sum(UserTokenUsage.tokens_output), 0).label("total_output"),
    ).filter(
        UserTokenUsage.user_id == user_id,
        UserTokenUsage.window_start == window_start,
    ).one()
    return {
        "tokens_input": int(result.total_input),
        "tokens_output": int(result.total_output),
        "total": int(result.total_input) + int(result.total_output),
    }
