"""
Repository for user token quota and usage tracking.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from shared.models.token_quota import UserTokenQuota, UserTokenUsage


# ── Quota ──────────────────────────────────────────────────────────────────

def get_quota(db: Session, user_id: int) -> Optional[UserTokenQuota]:
    return db.query(UserTokenQuota).filter(UserTokenQuota.user_id == user_id).first()


def upsert_quota(
    db: Session,
    user_id: int,
    token_limit: int,
    reset_interval_hours: int,
) -> UserTokenQuota:
    quota = get_quota(db, user_id)
    if quota:
        # Update limit and interval — do NOT touch last_reset_at (would reset the window)
        quota.token_limit = token_limit
        quota.reset_interval_hours = reset_interval_hours
        quota.updated_at = datetime.now(timezone.utc)
    else:
        # First time — align window_start to today's UTC midnight so existing
        # usage rows (logged with daily bucket) are included in this window
        now = datetime.now(timezone.utc)
        today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
        quota = UserTokenQuota(
            user_id=user_id,
            token_limit=token_limit,
            reset_interval_hours=reset_interval_hours,
            last_reset_at=today_midnight,
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
