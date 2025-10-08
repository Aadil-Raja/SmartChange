from app.repositories import teams_repo
from app.utils.response_utils import make_response
from sqlalchemy.orm import Session

from shared.models import Team, TeamMember, TeamMemberRole
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