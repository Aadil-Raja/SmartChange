# services/management/app/services/admin_service.py

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.repositories import users_repo, teams_repo
from shared.models import UserRole
from shared.models.team import TeamMemberRole ,TeamMember # Enum('member','manager')

from passlib.context import CryptContext
import time, jwt

# --- config & crypto ---
settings = get_settings()
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _verify_password(p: str, p_hash: str | None) -> bool:
    if not p_hash:
        return False
    return _pwd_ctx.verify(p, p_hash)


def _issue_access_token(user_id: int, token_version: int, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + ttl_seconds,
        "tv": token_version,
        "typ": "access",
        # optional: add "aud": "admin" if you want to distinguish admin tokens
        # "aud": "admin",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


# --------------------
# Admin login
# --------------------
def admin_login(db: Session, *, email: str, password: str):
    """
    Admin-only login. Reuses password verification and issues an access token.
    """
    user = users_repo.get_by_email(db, email.strip().lower())
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No account. Please sign up.")

    if not _verify_password(password, getattr(user, "password_hash", None)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")

    token = _issue_access_token(user.id, getattr(user, "token_version", 0) or 0)
    return {"loggedIn": True, "access_token": token, "token_type": "bearer"}


# --------------------
# Teams
# --------------------
def create_team(db: Session, *, name: str):
    """
    Create a team with a unique name.
    """
    existing = db.query(teams_repo.Team).filter(teams_repo.Team.name == name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Team name already exists")

    return teams_repo.create_team(db, name)


def list_teams(db: Session):
    return teams_repo.list_teams(db)


def get_team_with_members(db: Session, id: int):
    team = teams_repo.get_team(db, id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Pull memberships (or you can use team.members if relationship is configured)
    members = db.query(TeamMember).filter_by(team_id=id).all()

    # Return the exact shape the schema expects
    return {
        "team": team,  # Pydantic will read this via from_attributes=True in TeamOut
        "members": [
            {"user_id": m.user_id, "role_in_team": m.role_in_team.value}
            for m in members
        ],
    }

def add_member(db: Session, *, team_id: int, user_id: int, role_in_team: TeamMemberRole):
    """
    Add a user to a team with the given team-scoped role.
    """
    user = users_repo.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return teams_repo.add_member(db, team_id, user_id, role_in_team)


def remove_member(db: Session, *, team_id: int, user_id: int):
    existing = db.query(teams_repo.TeamMember).filter_by(team_id=team_id, user_id=user_id).first()
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    teams_repo.remove_member(db, team_id, user_id)
    return {"removed": True, "user_id": user_id, "team_id": team_id}
