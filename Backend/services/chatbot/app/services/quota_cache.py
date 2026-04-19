# app/services/quota_cache.py
"""
In-process quota cache for token usage.
Stores the current quota snapshot per user so /respond-v2 can return it
inline without an extra DB round-trip, and /chat/quota can serve it from
memory when fresh.

TTL: 5 minutes. After expiry the next read hits the DB and refreshes.
On every message the cache is updated in-place (tokens_used incremented)
so the value stays accurate without a DB query.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

_cache: dict = {}  # user_id -> (snapshot_dict, cached_at)
CACHE_TTL_SECONDS = 300  # 5 minutes


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get(user_id: int) -> Optional[dict]:
    entry = _cache.get(user_id)
    if not entry:
        return None
    snapshot, cached_at = entry
    if (_now() - cached_at).total_seconds() < CACHE_TTL_SECONDS:
        return snapshot
    del _cache[user_id]
    return None


def set(user_id: int, snapshot: dict):
    """Store a full quota snapshot (from DB query)."""
    _cache[user_id] = (snapshot, _now())


def increment(user_id: int, tokens_input: int, tokens_output: int):
    """
    Increment tokens_used in the cached snapshot after a message.
    If no cache entry exists, does nothing — next read will hit DB.
    """
    entry = _cache.get(user_id)
    if not entry:
        return
    snapshot, cached_at = entry
    added = tokens_input + tokens_output
    snapshot = dict(snapshot)  # shallow copy to avoid mutating original
    snapshot["tokens_used"] = snapshot.get("tokens_used", 0) + added
    if snapshot.get("token_limit") is not None:
        snapshot["tokens_remaining"] = max(
            0, snapshot["token_limit"] - snapshot["tokens_used"]
        )
    _cache[user_id] = (snapshot, cached_at)  # keep original cached_at (TTL unchanged)


def invalidate(user_id: int):
    """Force next read to hit DB (e.g. after admin reset or quota change)."""
    _cache.pop(user_id, None)
