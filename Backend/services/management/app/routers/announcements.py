# services/core/app/routes/announcements_routes.py
from fastapi import APIRouter, Depends, status, UploadFile, File, Form, Query
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
            db, 
            team_id=team_id, 
            author_id=current_user.id, 
            title=payload.title, 
            body=payload.body,
            related_course_id=payload.related_course_id
        )
    except Exception as e:
        return make_response(False, "Failed to create announcement", status_code=500, error=str(e))

# List announcements (team members only) - WITH PAGINATION
@router.get("/{team_id}/announcements", status_code=status.HTTP_200_OK)
def list_announcements_route(
    team_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.list_team_announcements(
            db, team_id=team_id, user_id=current_user.id, limit=limit, offset=offset
        )
    except Exception as e:
        return make_response(False, "Failed to fetch announcements", status_code=500, error=str(e))

# Get single announcement (with comments) - WITH PAGINATION FOR COMMENTS
@router.get("/{team_id}/announcements/{announcement_id}", status_code=status.HTTP_200_OK)
def get_announcement_route(
    team_id: int,
    announcement_id: int,
    comment_limit: int = Query(50, ge=1, le=200),
    comment_offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.get_announcement_with_comments(
            db, team_id=team_id, announcement_id=announcement_id, user_id=current_user.id,
            comment_limit=comment_limit, comment_offset=comment_offset
        )
    except Exception as e:
        return make_response(False, "Failed to fetch announcement", status_code=500, error=str(e))

# Update announcement (author only)
@router.patch("/{team_id}/announcements/{announcement_id}", status_code=status.HTTP_200_OK)
def update_announcement_route(
    team_id: int,
    announcement_id: int,
    payload: schemas.AnnouncementUpdateIn,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.update_announcement(
            db, team_id=team_id, announcement_id=announcement_id, 
            user_id=current_user.id, title=payload.title, body=payload.body
        )
    except Exception as e:
        return make_response(False, "Failed to update announcement", status_code=500, error=str(e))

# Delete announcement (author only)
@router.delete("/{team_id}/announcements/{announcement_id}", status_code=status.HTTP_200_OK)
def delete_announcement_route(
    team_id: int,
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.delete_announcement(
            db, team_id=team_id, announcement_id=announcement_id, user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to delete announcement", status_code=500, error=str(e))

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
        return make_response(False, "Failed to add comment", status_code=500, error=str(e))

# Delete comment (commentator only)
@router.delete("/{team_id}/announcements/{announcement_id}/comments/{comment_id}", status_code=status.HTTP_200_OK)
def delete_comment_route(
    team_id: int,
    announcement_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.delete_comment(
            db, team_id=team_id, announcement_id=announcement_id, 
            comment_id=comment_id, user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to delete comment", status_code=500, error=str(e))

# List team members (manager only)
@router.get("/{team_id}/members", status_code=status.HTTP_200_OK)
def list_team_members_route(
    team_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.list_team_members(db, team_id=team_id, user_id=current_user.id)
    except Exception as e:
        return make_response(False, "Failed to fetch team members", status_code=500, error=str(e))

# Get member progress (manager only)
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
        return make_response(False, "Failed to fetch member progress", status_code=500, error=str(e))

# Upload attachment to announcement (author only)
@router.post("/{team_id}/announcements/{announcement_id}/attachments", status_code=status.HTTP_201_CREATED)
async def upload_attachment_route(
    team_id: int,
    announcement_id: int,
    file: UploadFile = File(...),
    attachment_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        file_bytes = await file.read()
        if not file_bytes:
            return make_response(False, "Empty file", status_code=400)
        
        return announcements_service.upload_announcement_attachment(
            db,
            team_id=team_id,
            announcement_id=announcement_id,
            user_id=current_user.id,
            file_bytes=file_bytes,
            filename=file.filename,
            attachment_type=attachment_type
        )
    except Exception as e:
        return make_response(False, "Failed to upload attachment", status_code=500, error=str(e))

# List attachments for an announcement
@router.get("/{team_id}/announcements/{announcement_id}/attachments", status_code=status.HTTP_200_OK)
def list_attachments_route(
    team_id: int,
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.list_announcement_attachments(
            db, team_id=team_id, announcement_id=announcement_id, user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to fetch attachments", status_code=500, error=str(e))

# Delete attachment (author only)
@router.delete("/{team_id}/announcements/{announcement_id}/attachments/{attachment_id}", status_code=status.HTTP_200_OK)
def delete_attachment_route(
    team_id: int,
    announcement_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    try:
        return announcements_service.delete_announcement_attachment(
            db,
            team_id=team_id,
            announcement_id=announcement_id,
            attachment_id=attachment_id,
            user_id=current_user.id
        )
    except Exception as e:
        return make_response(False, "Failed to delete attachment", status_code=500, error=str(e))