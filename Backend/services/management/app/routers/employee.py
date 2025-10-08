from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import employee_service
from app.utils.response_utils import make_response
import shared.schemas as schemas

router = APIRouter()

# ---------------------------
# My Teams
# ---------------------------
@router.get("/my-teams", status_code=status.HTTP_200_OK)
def my_teams_route(
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Return teams the logged-in user is part of.
    If the user is a manager, include the join_code.
    """
    try:
        return employee_service.get_my_teams(db, user)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)


# ---------------------------
# Join Team with Code
# ---------------------------
@router.post("/join", status_code=status.HTTP_200_OK)
def join_team_with_code_route(
    payload: schemas.JoinCodeIn,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """
    Join a team using a 6-digit code.
    """
    try:
        return employee_service.join_with_code(db, user_id=current_user.id, code=payload.code)
    except Exception as e:
        return make_response(False, "Unexpected server error", status_code=500)



@router.post("/{team_id}/regenerate-code", status_code=status.HTTP_200_OK)
def regenerate_team_code_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    """Regenerate the 6-digit join code (only if caller is a manager of this team)."""
    try:
        return employee_service.regenerate_team_code(db, user_id=current_user.id, team_id=team_id)
    except Exception:
        return make_response(False, "Unexpected server error", status_code=500)
