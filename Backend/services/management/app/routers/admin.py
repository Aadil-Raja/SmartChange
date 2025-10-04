from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.deps.db import get_db
from app.deps.auth import get_current_admin
import shared.schemas as schemas
from app.services import admin_service
from app.utils.response_utils import make_response  # ✅ new import

router = APIRouter()

# ---------------------------
# Admin Auth
# ---------------------------
@router.post("/login", status_code=status.HTTP_200_OK)
def admin_login_route(payload: schemas.AdminLoginIn, db: Session = Depends(get_db)):
    """
    Admin-only login. Returns access token or error JSON.
    """
    try:
        return admin_service.admin_login(db, email=payload.email, password=payload.password)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


# ---------------------------
# Teams CRUD (Admin only)
# ---------------------------
@router.post("/teams", status_code=status.HTTP_201_CREATED)
def create_team_route(
    payload: schemas.TeamCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Create a team (unique name).
    """
    try:
        return admin_service.create_team(db, name=payload.name)
    except Exception as e:
        return make_response(False, "Could not create team", status_code=500)


@router.get("/teams", status_code=status.HTTP_200_OK)
def list_teams_route(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    List all teams.
    """
    try:
        return admin_service.list_teams(db)
    except Exception as e:
        return make_response(False, "Could not load team list", status_code=500)


@router.get("/teams/{id}", status_code=status.HTTP_200_OK)
def get_team_route(
    id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Get a single team with its members.
    """
    try:
        return admin_service.get_team_with_members(db, id)
    except Exception as e:
        return make_response(False, "Could not load team details", status_code=500)


@router.post("/teams/{id}/members", status_code=status.HTTP_201_CREATED)
def add_member_route(
    id: int,
    payload: schemas.TeamMemberAdd,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Add a member to a team.
    """
    try:
        return admin_service.add_member(
            db,
            team_id=id,
            user_id=payload.user_id,
            role_in_team=payload.role_in_team,
        )
    except Exception as e:
        return make_response(False, "Could not add member", status_code=500)


@router.delete("/teams/{id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_member_route(
    id: int,
    user_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    Remove a member from a team.
    """
    try:
        return admin_service.remove_member(db, team_id=id, user_id=user_id)
    except Exception as e:
        return make_response(False, "Could not remove member", status_code=500)
