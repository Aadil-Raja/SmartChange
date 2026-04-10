"""
Leaderboard repository — single aggregation query per team.
All points computed from existing tables, no new schema needed.

Points:
  - Content item completed        → 10 pts
  - Quiz passed                   → 20 pts
  - Quiz passed on 1st attempt    → 30 pts (replaces the 20)
  - Course completed              → 50 pts
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session


# ── simple in-process cache ────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(prefix: str, team_id: int, period: str) -> str:
    return f"{prefix}:{team_id}:{period}"


def _get_cached(key: str):
    entry = _cache.get(key)
    if not entry:
        return None
    data, computed_at = entry
    if (datetime.now(timezone.utc) - computed_at).total_seconds() < CACHE_TTL_SECONDS:
        return data
    del _cache[key]
    return None


def _set_cache(key: str, data):
    _cache[key] = (data, datetime.now(timezone.utc))


def invalidate_team_cache(team_id: int):
    for period in ("7d", "all"):
        _cache.pop(_cache_key("lb", team_id, period), None)
        _cache.pop(_cache_key("eng", team_id, period), None)


# ── public API ─────────────────────────────────────────────────────────────────

def get_team_leaderboard(db: Session, *, team_id: int, period: str = "7d") -> dict:
    key = _cache_key("lb", team_id, period)
    cached = _get_cached(key)
    if cached:
        return cached

    since = _since_dt(period)
    result = _compute_leaderboard(db, team_id=team_id, since=since, period=period)
    _set_cache(key, result)
    return result


def get_team_engagement(db: Session, *, team_id: int, period: str = "7d") -> dict:
    key = _cache_key("eng", team_id, period)
    cached = _get_cached(key)
    if cached:
        return cached

    since = _since_dt(period)
    result = _compute_engagement(db, team_id=team_id, since=since, period=period)
    _set_cache(key, result)
    return result


# ── helpers ────────────────────────────────────────────────────────────────────

def _since_dt(period: str) -> Optional[datetime]:
    if period == "7d":
        return datetime.now(timezone.utc) - timedelta(days=7)
    return None


def _compute_leaderboard(
    db: Session, *, team_id: int, since: Optional[datetime], period: str
) -> dict:

    params: dict = {"team_id": team_id}
    if since:
        params["since"] = since

    # ── all team members ───────────────────────────────────────────────────────
    members_rows = db.execute(
        text("""
            SELECT u.id AS user_id, u."Name" AS name, u.profile_picture_url
            FROM team_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = :team_id
            ORDER BY u."Name"
        """),
        {"team_id": team_id},
    ).fetchall()

    if not members_rows:
        return {"team_id": team_id, "period": period,
                "computed_at": datetime.now(timezone.utc).isoformat(), "entries": []}

    # ── content completions ────────────────────────────────────────────────────
    content_sql = """
        SELECT tm.user_id, COUNT(up.id) AS content_done
        FROM team_members tm
        JOIN user_progress up ON up.user_id = tm.user_id
        WHERE tm.team_id = :team_id
          AND up.completed_at IS NOT NULL
          {since_filter}
        GROUP BY tm.user_id
    """
    content_rows = db.execute(
        text(content_sql.format(
            since_filter="AND up.completed_at >= :since" if since else ""
        )),
        params,
    ).fetchall()
    content_map = {r.user_id: r.content_done for r in content_rows}

    # ── quiz passes ────────────────────────────────────────────────────────────
    quiz_sql = """
        SELECT tm.user_id, COUNT(qa.id) AS quizzes_passed
        FROM team_members tm
        JOIN quiz_attempts qa ON qa.user_id = tm.user_id
        WHERE tm.team_id = :team_id
          AND qa.passed = TRUE
          {since_filter}
        GROUP BY tm.user_id
    """
    quiz_rows = db.execute(
        text(quiz_sql.format(
            since_filter="AND qa.completed_at >= :since" if since else ""
        )),
        params,
    ).fetchall()
    quiz_map = {r.user_id: r.quizzes_passed for r in quiz_rows}

    # ── first-attempt passes (bonus) ───────────────────────────────────────────
    first_sql = """
        SELECT qa.user_id, COUNT(*) AS first_pass_count
        FROM quiz_attempts qa
        JOIN team_members tm ON tm.user_id = qa.user_id AND tm.team_id = :team_id
        WHERE qa.passed = TRUE
          {since_filter}
          AND qa.id = (
              SELECT id FROM quiz_attempts inner_qa
              WHERE inner_qa.user_id = qa.user_id
                AND inner_qa.quiz_id = qa.quiz_id
              ORDER BY inner_qa.completed_at ASC
              LIMIT 1
          )
        GROUP BY qa.user_id
    """
    first_rows = db.execute(
        text(first_sql.format(
            since_filter="AND qa.completed_at >= :since" if since else ""
        )),
        params,
    ).fetchall()
    first_map = {r.user_id: r.first_pass_count for r in first_rows}

    # ── course completions ─────────────────────────────────────────────────────
    course_sql = """
        SELECT tm.user_id, COUNT(ce.id) AS courses_completed
        FROM team_members tm
        JOIN course_enrollments ce ON ce.user_id = tm.user_id
        WHERE tm.team_id = :team_id
          AND ce.completed_at IS NOT NULL
          {since_filter}
        GROUP BY tm.user_id
    """
    course_rows = db.execute(
        text(course_sql.format(
            since_filter="AND ce.completed_at >= :since" if since else ""
        )),
        params,
    ).fetchall()
    course_map = {r.user_id: r.courses_completed for r in course_rows}

    # ── compute points ─────────────────────────────────────────────────────────
    entries = []
    for m in members_rows:
        uid = m.user_id
        content_done   = content_map.get(uid, 0)
        quizzes_passed = quiz_map.get(uid, 0)
        first_passes   = first_map.get(uid, 0)
        courses_done   = course_map.get(uid, 0)

        # first-attempt passes get 30 pts; regular passes get 20 pts
        regular_passes = quizzes_passed - first_passes
        points = (
            content_done   * 10
            + regular_passes * 20
            + first_passes   * 30
            + courses_done   * 50
        )

        entries.append({
            "user_id":              uid,
            "name":                 m.name or "Unknown",
            "avatar_url":           m.profile_picture_url,
            "points":               points,
            "content_done":         content_done,
            "quizzes_passed":       quizzes_passed,
            "first_attempt_passes": first_passes,
            "courses_completed":    courses_done,
        })

    # sort: points desc, name asc for ties
    entries.sort(key=lambda x: (-x["points"], x["name"]))

    # assign ranks (ties share rank)
    rank = 1
    for i, entry in enumerate(entries):
        if i > 0 and entry["points"] < entries[i - 1]["points"]:
            rank = i + 1
        entry["rank"] = rank

    return {
        "team_id":    team_id,
        "period":     period,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "entries":    entries,
    }


def _compute_engagement(
    db: Session, *, team_id: int, since: Optional[datetime], period: str
) -> dict:
    params: dict = {"team_id": team_id}
    if since:
        params["since"] = since

    sql = f"""
        SELECT
            (SELECT COUNT(*) FROM team_members WHERE team_id = :team_id) AS total_members,
            (
                SELECT COUNT(DISTINCT up2.user_id)
                FROM team_members tm2
                JOIN user_progress up2 ON up2.user_id = tm2.user_id
                WHERE tm2.team_id = :team_id
                  AND up2.completed_at IS NOT NULL
                  {"AND up2.completed_at >= :since" if since else ""}
            ) AS active_learners,
            (
                SELECT COUNT(up3.id)
                FROM team_members tm3
                JOIN user_progress up3 ON up3.user_id = tm3.user_id
                WHERE tm3.team_id = :team_id
                  AND up3.completed_at IS NOT NULL
                  {"AND up3.completed_at >= :since" if since else ""}
            ) AS total_content_done,
            (
                SELECT COUNT(DISTINCT qa2.id)
                FROM team_members tm4
                JOIN quiz_attempts qa2 ON qa2.user_id = tm4.user_id
                WHERE tm4.team_id = :team_id
                  AND qa2.passed = TRUE
                  {"AND qa2.completed_at >= :since" if since else ""}
            ) AS quizzes_passed,
            (
                SELECT COUNT(DISTINCT ce2.id)
                FROM team_members tm5
                JOIN course_enrollments ce2 ON ce2.user_id = tm5.user_id
                WHERE tm5.team_id = :team_id
                  AND ce2.completed_at IS NOT NULL
                  {"AND ce2.completed_at >= :since" if since else ""}
            ) AS courses_completed
    """

    row = db.execute(text(sql), params).fetchone()

    return {
        "team_id":           team_id,
        "period":            period,
        "total_members":     row.total_members     or 0,
        "active_learners":   row.active_learners   or 0,
        "total_content_done": row.total_content_done or 0,
        "quizzes_passed":    row.quizzes_passed    or 0,
        "courses_completed": row.courses_completed or 0,
    }
