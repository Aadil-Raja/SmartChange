from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.services import announcements_service
from app.utils.response_utils import make_response
import shared.schemas as schemas

router = APIRouter()

# Create announcement (manager only)
@router.post("/{team_id}/announcements", status_code=status.HTTP_201_CREATED)
def create_announcement_route(
    team_id: int,
    payload: schemas.AnnouncementCreateIn,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.create_announcement(
            db, team_id=team_id, author_id=current_user.id, title=payload.title, body=payload.body
        )
    except Exception as e:
        return make_response(False, "Could not create announcement", status_code=500, error=str(e))

# List announcements (team members only)
@router.get("/{team_id}/announcements", status_code=status.HTTP_200_OK)
def list_announcements_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.list_team_announcements(db, team_id=team_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Could not fetch announcements", status_code=500, error=str(e))

# Get single announcement (with comments)
@router.get("/{team_id}/announcements/{announcement_id}", status_code=status.HTTP_200_OK)
def get_announcement_route(
    team_id: int,
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.get_announcement_with_comments(
            db, team_id=team_id, announcement_id=announcement_id, user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Could not fetch announcement", status_code=500, error=str(e))

# Add comment (team members only)
@router.post("/{team_id}/announcements/{announcement_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment_route(
    team_id: int,
    announcement_id: int,
    payload: schemas.CommentCreateIn,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.add_comment(
            db, team_id=team_id, announcement_id=announcement_id, user_id=current_user.id, body=payload.body
        )
    except Exception as e:
        return make_response(False, "Could not add comment", status_code=500, error=str(e))
    



#List team members (manager only)
@router.get("/{team_id}/members", status_code=status.HTTP_200_OK)
def list_team_members_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.list_team_members(db, team_id=team_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Could not fetch team members", status_code=500, error=str(e))
    


@router.get("/{team_id}/members/{member_user_id}/progress", status_code=status.HTTP_200_OK)
def get_member_progress_route(
    team_id: int,
    member_user_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.get_member_progress_overview(
            db, team_id=team_id, manager_id=current_user.id, member_user_id=member_user_id
        )
    except Exception as e:
        return make_response(False, "Could not fetch member progress", status_code=500, error=str(e))