from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.repositories import users_repo, teams_repo, employees_repo
from shared.models import UserRole, TeamMemberRole, TeamMember
from app.utils.response_utils import make_response

from app.utils.shared_utils import (
    verify_password,
    issue_access_token,
)

settings = get_settings()


# ----------------------------------------------------------------------
# ADMIN AUTHENTICATIONs
# ----------------------------------------------------------------------

def admin_login(db: Session, *, email: str, password: str):
    """
    Admin-only login endpoint.
    """
    user = users_repo.get_by_email(db, email.strip().lower())
    
    if not user:
        return make_response(False, "Invalid email or password", status_code=401)

    if not verify_password(password, getattr(user, "password_hash", None)):
        return make_response(False, "Invalid email or password", status_code=401)

    if user.role != UserRole.admin:
        return make_response(False, "Access denied", status_code=403)

    token = issue_access_token(
        user_id=user.id,
        token_version=getattr(user, "token_version", 0) or 0,
        ttl_seconds=3600,
        jwt_secret=settings.jwt_secret,
        jwt_algorithm=settings.jwt_algorithm,
    )

    return make_response(
        True,
        "Login successful",
        data={
            "access_token": token,
            "token_type": "bearer"
        },
        status_code=200
    )


# ----------------------------------------------------------------------
# TEAM MANAGEMENT
# ----------------------------------------------------------------------

def create_team(db: Session, *, name: str):
    """
    Create a new team with unique name.
    """
    existing = db.query(teams_repo.Team).filter(teams_repo.Team.name == name).first()
    if existing:
        return make_response(False, "Team name already exists", status_code=409)

    team = teams_repo.create_team(db, name)
    
    return make_response(
        True,
        "Team created successfully",
        data={
            "id": team.id,
            "name": team.name,
            "created_at": team.created_at
        },
        status_code=201
    )


def list_teams(db: Session):
    """
    Get all teams.
    """
    teams = teams_repo.list_teams(db)
    
    return make_response(
        True,
        "Teams retrieved successfully",
        data={
            "teams": [
                {
                    "id": t.id,
                    "name": t.name,
                    "created_at": t.created_at,
                    "member_count": len(getattr(t, "members", []))
                }
                for t in teams
            ]
        },
        status_code=200
    )


def get_team_with_members(db: Session, id: int):
    """
    Get team details with member list.
    """
    team = teams_repo.get_team(db, id)
    if not team:
        return make_response(False, "Team not found", status_code=404)

    members = db.query(TeamMember).filter_by(team_id=id).all()

    return make_response(
        True,
        "Team retrieved successfully",
        data={
            "id": team.id,
            "name": team.name,
            "created_at": team.created_at,
            "members": [
                {
                    "user_id": m.user_id,
                    "role": m.role_in_team.value
                }
                for m in members
            ]
        },
        status_code=200
    )


# ----------------------------------------------------------------------
# TEAM MEMBER MANAGEMENT
# ----------------------------------------------------------------------

def add_member(db: Session, *, team_id: int, user_id: int, role_in_team: TeamMemberRole):
    """
    Add user to team with specified role.
    """
    team = teams_repo.get_team(db, team_id)
    if not team:
        return make_response(False, "Team not found", status_code=404)
    
    user = users_repo.get_by_id(db, user_id)
    if not user:
        return make_response(False, "User not found", status_code=404)

    # Check if already member
    existing = db.query(TeamMember).filter_by(team_id=team_id, user_id=user_id).first()
    if existing:
        return make_response(False, "User already in team", status_code=409)

    tm = teams_repo.add_member(db, team_id, user_id, role_in_team)

    return make_response(
        True,
        "Member added successfully",
        data={
            "user_id": tm.user_id,
            "team_id": team_id,
            "role": tm.role_in_team.value
        },
        status_code=201
    )


def remove_member(db: Session, *, team_id: int, user_id: int):
    """
    Remove user from team.
    """
    existing = db.query(TeamMember).filter_by(team_id=team_id, user_id=user_id).first()
    if not existing:
        return make_response(False, "Member not found in team", status_code=404)

    teams_repo.remove_member(db, team_id, user_id)

    return make_response(
        True,
        "Member removed successfully",
        status_code=200
    )


def update_team_member_role(db: Session, *, team_id: int, user_id: int, new_role: TeamMemberRole):
    """
    Update a team member's role by (team_id, user_id).
    """
    tm = (
        db.query(TeamMember)
        .filter_by(team_id=team_id, user_id=user_id)
        .first()
    )
    if not tm:
        return make_response(False, "Member not found in team", status_code=404)

    tm.role_in_team = new_role
    db.commit()
    db.refresh(tm)

    return make_response(
        True,
        "Role updated successfully",
        data={
            "team_member_id": tm.id,
            "team_id": tm.team_id,
            "user_id": tm.user_id,
            "new_role": tm.role_in_team.value,
        },
        status_code=200,
    )
# ----------------------------------------------------------------------
# EMPLOYEE MANAGEMENT
# ----------------------------------------------------------------------

def list_employees(db: Session):
    """
    List all non-admin users with their team info.
    """
    rows = employees_repo.list_non_admin_users(db)

    employees = []
    for user, team_id, team_name, team_role in rows:
        employees.append({
            "id": user.id,
            "email": user.email,
            "name": getattr(user, "name", None),
            "role": user.role.value,
            "team_id": team_id,
            "team_name": team_name,
            "team_role": team_role.value if team_role else None,
            "created_at": user.created_at,
        })

    return make_response(
        True,
        "Employees retrieved successfully",
        data={"employees": employees},
        status_code=200
    )


# ----------------------------------------------------------------------
# REFERENCE DATA
# ----------------------------------------------------------------------

def get_team_roles():
    """
    Get available team roles.
    """
    roles = [{"value": r.value, "name": r.name} for r in TeamMemberRole]
    
    return make_response(
        True,
        "Team roles retrieved successfully",
        data={"roles": roles},
        status_code=200
    )




def delete_user(db: Session, *, user_id: int):
    user = users_repo.get_by_id(db, user_id)
    if not user:
        return make_response(False, "User not found", 404)
    if user.role == UserRole.admin:
        return make_response(False, "Cannot delete admin users", 403)

    db.delete(user)
    db.commit()
    return make_response(True, "User deleted successfully", 200)


def update_team(db: Session, *, id: int, name: str):
    """
    Update team name.
    """
    # Check if name is already taken by another team
    existing = db.query(teams_repo.Team).filter(
        teams_repo.Team.name == name,
        teams_repo.Team.id != id
    ).first()
    if existing:
        return make_response(False, "Team name already exists", status_code=409)

    team = teams_repo.update_team(db, id, name)
    if not team:
        return make_response(False, "Team not found", status_code=404)

    return make_response(
        True,
        "Team updated successfully",
        data={
            "id": team.id,
            "name": team.name,
            "created_at": team.created_at
        },
        status_code=200
    )


def delete_team(db: Session, *, id: int):
    """
    Delete a team and all its members.
    """
    team = teams_repo.get_team(db, id)
    if not team:
        return make_response(False, "Team not found", status_code=404)

    success = teams_repo.delete_team(db, id)
    if not success:
        return make_response(False, "Failed to delete team", status_code=500)

    return make_response(
        True,
        "Team deleted successfully",
        status_code=200
    )
