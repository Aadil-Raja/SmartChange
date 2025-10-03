# services/management/app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.deps.db import get_db
from app.deps.auth import get_current_admin
import shared.schemas as schemas
from app.services import admin_service

router = APIRouter()


# ---------------------------
# Admin Auth
# ---------------------------
@router.post("/login", status_code=status.HTTP_200_OK)
def admin_login_route(payload: schemas.AdminLoginIn, db: Session = Depends(get_db)):
    """
    Admin-only login. Reuses password auth, but only succeeds if user.role == 'admin'.
    Returns an access token.
    """
    try:
        return admin_service.admin_login(db, email=payload.email, password=payload.password)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Admin login failed")


# ---------------------------
# Teams CRUD (Admin only)
# ---------------------------
@router.post("/teams", response_model=schemas.TeamOut, status_code=status.HTTP_201_CREATED)
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
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not create team")


@router.get("/teams", response_model=list[schemas.TeamOut], status_code=status.HTTP_200_OK)
def list_teams_route(
    db: Session = Depends(get_db),
    _admin=Depends(get_current_admin),
):
    """
    List all teams.
    """
    return admin_service.list_teams(db)


@router.get("/teams/{id}", response_model=schemas.TeamWithMembers, status_code=status.HTTP_200_OK)
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
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not load team")


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
        tm = admin_service.add_member(
            db,
            team_id=id,
            user_id=payload.user_id,
            role_in_team=payload.role_in_team,
        )
        return {
            "added": True,
            "team_id": id,
            "user_id": tm.user_id,
            "role_in_team": tm.role_in_team.value,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not add member")


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
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Could not remove member")
