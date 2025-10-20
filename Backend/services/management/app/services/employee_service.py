from app.repositories import teams_repo
from app.utils.response_utils import make_response
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from shared.models import Team, TeamMember, TeamMemberRole
from app.repositories import progress_repo as prog_repo
from app.repositories import courseContent_repo as content_repo
def get_my_teams(db, user):
    rows = teams_repo.get_teams_for_user(db, user.id)
    data = []

    for team, role in rows:
        members = [m.user_id for m in team.members]  # quick minimal member list
        data.append({
            "team_id": team.id,
            "team_name": team.name,
            "join_code": team.join_code if role.value == "manager" else None,  # ✅ only managers see code
            "role_in_team": role.value,
            "members": members
        })

    return make_response(True, "Teams fetched successfully", data=data,status_code=200)

def join_with_code(db: Session, *, user_id: int, code: str):
    """Allow a user to join a team using its unique join code."""
    code = code.strip()

    team = db.query(Team).filter(Team.join_code == code).first()
    if not team:
        return make_response(False, "Invalid or expired team code", status_code=400)

    existing = db.query(TeamMember).filter_by(team_id=team.id, user_id=user_id).first()
    if existing:
        return make_response(True, "Already a member of this team", data={
            "team_id": team.id, "team_name": team.name, "role_in_team": existing.role_in_team.value
        }, status_code=200)

    tm = TeamMember(team_id=team.id, user_id=user_id, role_in_team=TeamMemberRole.member)
    db.add(tm)
    db.commit()
    db.refresh(tm)

    return make_response(True, "Joined team successfully", data={
        "team_id": team.id,
        "team_name": team.name,
        "role_in_team": tm.role_in_team.value
    }, status_code=200)




def regenerate_team_code(db: Session, *, user_id: int, team_id: int):
    """Only a manager of the team can regenerate its join code."""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        return make_response(False, "Team not found", status_code=404)

    membership = (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
        .first()
    )
    if not membership or membership.role_in_team != TeamMemberRole.manager:
        return make_response(False, "Only team managers can regenerate codes", status_code=403)

    # ✅ Use the repo’s helper
    team.join_code = teams_repo._generate_unique_code(db)
    db.commit()
    db.refresh(team)

    return make_response(True, "Join code regenerated successfully", data={
        "team_id": team.id,
        "team_name": team.name,
        "join_code": team.join_code
    }, status_code=200)


def update_progress(
    db: Session,
    *,
    user_id: int,
    content_id: int,
    progress: float,
    completed: bool | None,
) -> Dict[str, Any]:
    mark_complete = bool(completed) or progress >= 100.0
    row = prog_repo.upsert_progress(
        db,
        user_id=user_id,
        content_id=content_id,
        progress=progress,
        mark_complete=mark_complete,
    )
    return {
        "content_id": row.content_id,
        "progress": float(row.progress),
        "completed_at": row.completed_at,
        "last_viewed_at": row.last_viewed_at,
    }


def course_progress(
    db: Session,
    *,
    user_id: int,
    course_id: int,
) -> Dict[str, Any]:
    # all items in the course
    items = content_repo.list_items_for_course(db, course_id=course_id)
    content_ids = [it.id for it in items]
    total_items = len(content_ids)
    
    if total_items == 0:
        return {"course_id": course_id, "completed_items": 0, "total_items": 0, "percent": 0.0}
    
    # user progress rows
    rows = prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
    
    # completed = completed_at not null OR progress >= 100
    completed_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
    completed_items = len(completed_ids)
    percent = round((completed_items / total_items) * 100.0, 2)
    
    return {
        "course_id": course_id,
        "completed_items": completed_items,
        "total_items": total_items,
        "percent": percent,
    }

def course_items_progress(
    db: Session,
    *,
    user_id: int,
    course_id: int,
) -> Dict[str, Any]:
    # All items in the course
    items = content_repo.list_items_for_course(db, course_id=course_id)
    content_ids: List[int] = [it.id for it in items]

    # If no items, return empty list
    if not content_ids:
        return {"course_id": course_id, "items": []}

    # Get progress rows for this user across these items
    rows = prog_repo.list_for_user_and_content_ids(
        db, user_id=user_id, content_ids=content_ids
    )
    by_id = {r.content_id: r for r in rows}

    # Build per-item progress (default 0 if no row yet)
    result = []
    for it in items:
        r = by_id.get(it.id)
        t = it.type.value if hasattr(it.type, "value") else str(it.type)
        result.append({
            "content_id": it.id,
            "title": it.title,
            "type": t,
            "progress": float(r.progress) if r else 0.0,
            "completed_at": r.completed_at if r else None,
            "last_viewed_at": r.last_viewed_at if r else None,
        })

    return {"course_id": course_id, "items": result}