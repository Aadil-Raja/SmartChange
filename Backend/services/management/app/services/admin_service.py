from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.repositories import users_repo, teams_repo,employees_repo
from shared.models import UserRole, TeamMemberRole, TeamMember
from app.utils.response_utils import make_response  # ✅ Unified JSON response function

from app.services.shared_utils import (
    verify_password,
    issue_access_token,
)

settings = get_settings()

# --------------------
# Admin login
# --------------------
def admin_login(db: Session, *, email: str, password: str):
    """
    Admin-only login. Reuses password verification and issues an access token.
    """
    user = users_repo.get_by_email(db, email.strip().lower())
    if not user:
        return make_response(False, "No account. Please sign up.", status_code=404)

    if not verify_password(password, getattr(user, "password_hash", None)):
        return make_response(False, "Invalid credentials", status_code=401)

    if user.role != UserRole.admin:
        return make_response(False, "Admins only", status_code=403)

    token = issue_access_token(
        user_id=user.id,
        token_version=getattr(user, "token_version", 0) or 0,
        ttl_seconds=3600,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
        # aud="admin",  # optional
    )

    data = {"access_token": token, "token_type": "bearer"}
    return make_response(True, "Login successful", data=data, status_code=200)


# --------------------
# Teams
# --------------------
def create_team(db: Session, *, name: str):
    """
    Create a team with a unique name.
    """
    existing = db.query(teams_repo.Team).filter(teams_repo.Team.name == name).first()
    if existing:
        return make_response(False, "Team name already exists", status_code=409)

    team = teams_repo.create_team(db, name)
    return make_response(True, "Team created successfully", data=team, status_code=201)


def list_teams(db: Session):
    """
    List all existing teams.
    """
    teams = teams_repo.list_teams(db)
    return make_response(True, "Teams fetched successfully", data=teams, status_code=200)


def get_team_with_members(db: Session, id: int):
    """
    Fetch a single team along with all its members.
    """
    team = teams_repo.get_team(db, id)
    if not team:
        return make_response(False, "Team not found", status_code=404)

    # Pull memberships (or you can use team.members if relationship is configured)
    members = db.query(TeamMember).filter_by(team_id=id).all()

    # Return the exact shape the schema expects
    data = {
        "team": team,  # Pydantic will read this via from_attributes=True in TeamOut
        "members": [
            {"user_id": m.user_id, "role_in_team": m.role_in_team.value}
            for m in members
        ],
    }

    return make_response(True, "Team details fetched successfully", data=data, status_code=200)


def add_member(db: Session, *, team_id: int, user_id: int, role_in_team: TeamMemberRole):
    """
    Add a user to a team with the given team-scoped role.
    """
    user = users_repo.get_by_id(db, user_id)
    if not user:
        return make_response(False, "User not found", status_code=404)

    tm = teams_repo.add_member(db, team_id, user_id, role_in_team)

    data = {
        "team_id": team_id,
        "user_id": tm.user_id,
        "role_in_team": tm.role_in_team.value,
    }

    return make_response(True, "Member added successfully", data=data, status_code=201)


def remove_member(db: Session, *, team_id: int, user_id: int):
    """
    Remove a user from a team by their team ID and user ID.
    """
    existing = db.query(teams_repo.TeamMember).filter_by(team_id=team_id, user_id=user_id).first()
    if not existing:
        return make_response(False, "Membership not found", status_code=404)

    teams_repo.remove_member(db, team_id, user_id)

    data = {"removed": True, "user_id": user_id, "team_id": team_id}
    return make_response(True, "Member removed successfully", data=data, status_code=200)


def list_employees(db: Session):
    """
    List all users except admins, ordered by user.id ASC.
    Includes team_id, team name, and team_role if present.
    """
    # Adjust query in repo call to include team_id
    rows = employees_repo.list_non_admin_users(db)

    data = []
    for user, team_id, team_name, team_role in rows:
        data.append({
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
            "team_id": team_id,
            "team": team_name,
            "team_role": (team_role.value if team_role else None),
            "created_at": user.created_at,
        })

    return make_response(True, "Employees fetched successfully", data=data, status_code=200)


def get_team_roles():
    """
    Return all available team roles.
    """
    roles = [r.value for r in TeamMemberRole]
    return make_response(True, "Team roles fetched successfully", data={"roles": roles}, status_code=200)