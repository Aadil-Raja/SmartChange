from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.utils.response_utils import make_response
from app.repositories import leaderboard_repo
from shared.models import TeamMember

router = APIRouter()

VALID_PERIODS = "^(7d|30d|90d)$"


def _assert_team_member(db: Session, user_id: int, team_id: int):
    member = db.query(TeamMember).filter_by(team_id=team_id, user_id=user_id).first()
    return member is not None


@router.get("/teams/{team_id}/leaderboard")
def get_leaderboard(
    team_id: int,
    period: str = Query(default="7d", pattern=VALID_PERIODS),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not _assert_team_member(db, user.id, team_id):
        return make_response(False, "Not a member of this team", status_code=403)
    try:
        data = leaderboard_repo.get_team_leaderboard(db, team_id=team_id, period=period)
        for entry in data["entries"]:
            entry["is_me"] = entry["user_id"] == user.id
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, "Could not fetch leaderboard", status_code=500, error=str(e))


@router.get("/teams/{team_id}/engagement")
def get_engagement(
    team_id: int,
    period: str = Query(default="7d", pattern=VALID_PERIODS),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if not _assert_team_member(db, user.id, team_id):
        return make_response(False, "Not a member of this team", status_code=403)
    try:
        data = leaderboard_repo.get_team_engagement(db, team_id=team_id, period=period)
        return make_response(True, "OK", data=data)
    except Exception as e:
        return make_response(False, "Could not fetch engagement stats", status_code=500, error=str(e))
