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
    """Get quota and auto-reset if due. Only call this in the message flow."""
    quota = db.query(UserTokenQuota).filter(UserTokenQuota.user_id == user_id).first()
    if quota:
        quota = _auto_reset_if_due(db, quota)
    return quota


def peek_quota(db: Session, user_id: int) -> Optional[UserTokenQuota]:
    """Get quota WITHOUT triggering auto-reset. Use for read-only views (quota bar, admin)."""
    return db.query(UserTokenQuota).filter(UserTokenQuota.user_id == user_id).first()


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
    """Admin-triggered manual reset — clears the window so it starts fresh on next message."""
    quota = peek_quota(db, user_id)  # peek, not get — avoid auto-reset side effect
    if not quota:
        return None
    quota.last_reset_at = None  # NULL = window not started, begins on next user message
    quota.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
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


# ── Usage history (for admin graph) ───────────────────────────────────────

# Simple in-process cache: {user_id:days -> (data, computed_at)}
_usage_history_cache: dict = {}
_HISTORY_CACHE_TTL = 300  # 5 minutes


def get_usage_history(db: Session, user_id: int, days: int = 7) -> list:
    """
    Returns daily token usage for the last N days.
    Each entry: {date: 'YYYY-MM-DD', tokens_input: int, tokens_output: int, total: int}
    Cached for 5 minutes.
    """
    cache_key = f"{user_id}:{days}"
    entry = _usage_history_cache.get(cache_key)
    if entry:
        data, computed_at = entry
        if (datetime.now(timezone.utc) - computed_at).total_seconds() < _HISTORY_CACHE_TTL:
            return data

    since = datetime.now(timezone.utc) - timedelta(days=days)

    from sqlalchemy import cast, Date as SADate
    rows = db.query(
        cast(UserTokenUsage.created_at, SADate).label("day"),
        func.coalesce(func.sum(UserTokenUsage.tokens_input), 0).label("tokens_input"),
        func.coalesce(func.sum(UserTokenUsage.tokens_output), 0).label("tokens_output"),
    ).filter(
        UserTokenUsage.user_id == user_id,
        UserTokenUsage.created_at >= since,
    ).group_by(
        cast(UserTokenUsage.created_at, SADate)
    ).order_by(
        cast(UserTokenUsage.created_at, SADate)
    ).all()

    # Fill in missing days with 0
    result = []
    day_map = {str(r.day): r for r in rows}
    for i in range(days):
        d = (datetime.now(timezone.utc) - timedelta(days=days - 1 - i)).date()
        day_str = str(d)
        r = day_map.get(day_str)
        result.append({
            "date": day_str,
            "tokens_input": int(r.tokens_input) if r else 0,
            "tokens_output": int(r.tokens_output) if r else 0,
            "total": int(r.tokens_input + r.tokens_output) if r else 0,
        })

    _usage_history_cache[cache_key] = (result, datetime.now(timezone.utc))
    return result


def invalidate_usage_history_cache(user_id: int):
    for days in (7, 15, 30):
        _usage_history_cache.pop(f"{user_id}:{days}", None)


# ── Overall stats + top users (for admin dashboard) ───────────────────────

_overview_cache: dict = {}
_OVERVIEW_CACHE_TTL = 300  # 5 minutes


def get_usage_overview(db: Session, days: int = 7) -> dict:
    """
    Returns org-wide token usage stats for the last N days.
    {total_tokens, total_input, total_output, active_users, total_calls}
    Cached 5 min.
    """
    cache_key = f"overview:{days}"
    entry = _overview_cache.get(cache_key)
    if entry:
        data, computed_at = entry
        if (datetime.now(timezone.utc) - computed_at).total_seconds() < _OVERVIEW_CACHE_TTL:
            return data

    since = datetime.now(timezone.utc) - timedelta(days=days)

    result = db.query(
        func.coalesce(func.sum(UserTokenUsage.tokens_input), 0).label("total_input"),
        func.coalesce(func.sum(UserTokenUsage.tokens_output), 0).label("total_output"),
        func.count(UserTokenUsage.id).label("total_calls"),
        func.count(func.distinct(UserTokenUsage.user_id)).label("active_users"),
    ).filter(UserTokenUsage.created_at >= since).one()

    data = {
        "days": days,
        "total_input": int(result.total_input),
        "total_output": int(result.total_output),
        "total_tokens": int(result.total_input) + int(result.total_output),
        "total_calls": int(result.total_calls),
        "active_users": int(result.active_users),
    }
    _overview_cache[cache_key] = (data, datetime.now(timezone.utc))
    return data


def get_top_users_by_usage(db: Session, days: int = 7, limit: int = 10) -> list:
    """
    Returns top N users by total token usage in the last N days.
    Each entry: {user_id, total_tokens, total_input, total_output, total_calls}
    Cached 5 min per (days, limit).
    """
    limit = min(limit, 20)  # hard cap at 20
    cache_key = f"top:{days}:{limit}"
    entry = _overview_cache.get(cache_key)
    if entry:
        data, computed_at = entry
        if (datetime.now(timezone.utc) - computed_at).total_seconds() < _OVERVIEW_CACHE_TTL:
            return data

    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = db.query(
        UserTokenUsage.user_id,
        func.coalesce(func.sum(UserTokenUsage.tokens_input), 0).label("total_input"),
        func.coalesce(func.sum(UserTokenUsage.tokens_output), 0).label("total_output"),
        func.count(UserTokenUsage.id).label("total_calls"),
    ).filter(
        UserTokenUsage.created_at >= since
    ).group_by(
        UserTokenUsage.user_id
    ).order_by(
        (func.sum(UserTokenUsage.tokens_input) + func.sum(UserTokenUsage.tokens_output)).desc()
    ).limit(limit).all()

    data = [
        {
            "user_id": r.user_id,
            "total_input": int(r.total_input),
            "total_output": int(r.total_output),
            "total_tokens": int(r.total_input) + int(r.total_output),
            "total_calls": int(r.total_calls),
        }
        for r in rows
    ]
    _overview_cache[cache_key] = (data, datetime.now(timezone.utc))
    return data
