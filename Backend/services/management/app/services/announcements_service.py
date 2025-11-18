# services/core/app/services/announcements_service.py
from sqlalchemy.orm import Session
from app.utils.response_utils import make_response
from app.repositories import announcements_repo
from shared.models import TeamMember, TeamMemberRole, Announcement, AttachmentType
from app.repositories import progress_repo as prog_repo
from app.repositories import courseContent_repo as content_repo
from app.services import courseContent_service
from app.services.storage.storage_cloudinary import (
    upload_image_bytes, 
    upload_video_bytes, 
    upload_document_bytes,
    delete_file_by_public_id,
    delete_with_thumbnail
)

def _is_team_member(db: Session, *, team_id: int, user_id: int) -> bool:
    return db.query(TeamMember.id).filter_by(team_id=team_id, user_id=user_id).first() is not None

def _is_team_manager(db: Session, *, team_id: int, user_id: int) -> bool:
    tm = db.query(TeamMember.role_in_team).filter_by(team_id=team_id, user_id=user_id).first()
    return bool(tm and tm[0] == TeamMemberRole.manager)

def create_announcement(db: Session, *, team_id: int, author_id: int, title: str, body: str):
    if not _is_team_manager(db, team_id=team_id, user_id=author_id):
        return make_response(False, "Only team managers can create announcements", status_code=403)
    
    a = announcements_repo.create_announcement(db, team_id=team_id, author_id=author_id, title=title, body=body)
    return make_response(True, "Announcement created", data=a, status_code=201)

def list_team_announcements(db: Session, *, team_id: int, user_id: int, limit: int, offset: int):
    """List announcements with pagination"""
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)

    rows, total = announcements_repo.list_team_announcements(db, team_id=team_id, limit=limit, offset=offset)

    serialized = [
        {
            "id": a.id,
            "title": a.title,
            "body": a.body,
            "created_at": a.created_at,
            "team_id": a.team_id,
            "author_name": a.author.Name if a.author else None,
            "can_edit": a.author_id == user_id,
            "can_delete": a.author_id == user_id,
        }
        for a in rows
    ]

    return make_response(True, "Announcements fetched", data={
        "total": total,
        "items": serialized
    }, status_code=200)

def get_announcement_with_comments(
    db: Session, 
    *, 
    team_id: int, 
    announcement_id: int, 
    user_id: int,
    comment_limit: int,
    comment_offset: int
):
    """Get announcement with paginated comments"""
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    # Get paginated comments
    comment_rows, comment_total = announcements_repo.get_announcement_comments(
        db, announcement_id=announcement_id, limit=comment_limit, offset=comment_offset
    )
    
    comments = [
        {
            "id": c.id,
            "announcement_id": c.announcement_id,
            "body": c.body,
            "created_at": c.created_at,
            "user_name": c.user.Name if c.user else None,
            "can_delete": c.user_id == user_id,
        }
        for c in comment_rows
    ]
    
    attachments = [
        {
            "id": att.id,
            "attachment_type": att.attachment_type.value,
            "url": att.cloudinary_url,
            "thumbnail_url": att.cloudinary_thumbnail_url,
            "filename": att.original_filename,
            "size_bytes": att.size_bytes,
            "created_at": att.created_at
        }
        for att in a.attachments
    ]
    
    a_serialized = {
        "id": a.id,
        "team_id": a.team_id,
        "author_name": a.author.Name if a.author else None,
        "title": a.title,
        "body": a.body,
        "created_at": a.created_at,
        "can_edit": a.author_id == user_id,
        "can_delete": a.author_id == user_id,
    }
    
    data = {
        "announcement": a_serialized,
        "comments": {
            "total": comment_total,
            "items": comments
        },
        "attachments": attachments,
    }
    return make_response(True, "Announcement fetched", data=data, status_code=200)

def update_announcement(db: Session, *, team_id: int, announcement_id: int, user_id: int, title: str | None, body: str | None):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    if a.author_id != user_id:
        return make_response(False, "Only the author can update this announcement", status_code=403)
    
    if title is None and body is None:
        return make_response(False, "At least one field (title or body) must be provided", status_code=400)
    
    updated_announcement = announcements_repo.update_announcement(
        db, announcement_id=announcement_id, title=title, body=body
    )
    
    return make_response(True, "Announcement updated", data=updated_announcement, status_code=200)

def delete_announcement(db: Session, *, team_id: int, announcement_id: int, user_id: int):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    if a.author_id != user_id:
        return make_response(False, "Only the author can delete this announcement", status_code=403)
    
    # Delete all attachments from Cloudinary
    try:
        attachments = announcements_repo.list_announcement_attachments(db, announcement_id=announcement_id)
        for attachment in attachments:
            try:
                resource_type = "video" if attachment.attachment_type == AttachmentType.VIDEO else "image"
                delete_with_thumbnail(attachment.cloudinary_public_id, resource_type=resource_type)
            except Exception as e:
                print(f"Failed to delete attachment {attachment.id} from Cloudinary: {e}")
    except Exception as e:
        print(f"Failed to fetch attachments for deletion: {e}")
    
    announcements_repo.delete_announcement(db, announcement_id=announcement_id)
    
    return make_response(True, "Announcement deleted", status_code=200)

def add_comment(db: Session, *, team_id: int, announcement_id: int, user_id: int, body: str):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    c = announcements_repo.add_comment(db, announcement_id=announcement_id, user_id=user_id, body=body)
    return make_response(True, "Comment added", data=c, status_code=201)

def delete_comment(db: Session, *, team_id: int, announcement_id: int, comment_id: int, user_id: int):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    comment = announcements_repo.get_comment(db, comment_id=comment_id)
    if not comment or comment.announcement_id != announcement_id:
        return make_response(False, "Comment not found", status_code=404)
    
    if comment.user_id != user_id:
        return make_response(False, "Only the commentator can delete this comment", status_code=403)
    
    announcements_repo.delete_comment(db, comment_id=comment_id)
    
    return make_response(True, "Comment deleted", status_code=200)

def list_team_members(db: Session, *, team_id: int, user_id: int):
    if not _is_team_manager(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Only team managers can view team members", status_code=403)
    
    members = announcements_repo.get_team_members(db, team_id=team_id)
    
    serialized = []
    for m in members:
        if m.user_id == user_id:
            continue

        serialized.append(
            {
                "id": m.id,
                "user_id": m.user_id,
                "user_name": m.user.Name if m.user else None,
                "user_email": m.user.email if m.user else None,
                "role_in_team": m.role_in_team.value if m.role_in_team else None,
                "joined_at": m.created_at,
            }
        )
    
    return make_response(True, "Team members fetched", data=serialized, status_code=200)

def get_member_progress_overview(db: Session, *, team_id: int, manager_id: int, member_user_id: int):
    """Get progress overview for a specific team member (manager only)"""
    if not _is_team_manager(db, team_id=team_id, user_id=manager_id):
        return make_response(False, "Only team managers can view member progress", status_code=403)
    
    if not _is_team_member(db, team_id=team_id, user_id=member_user_id):
        return make_response(False, "User is not a member of this team", status_code=404)
    
    member = db.query(TeamMember).filter_by(team_id=team_id, user_id=member_user_id).first()
    if not member:
        return make_response(False, "Member not found", status_code=404)
    
    all_courses_data = courseContent_service.list_courses(db, active_only=True)
    all_courses = all_courses_data.get("courses", [])
    
    in_progress_courses = []
    completed_courses = []
    
    for course in all_courses:
        course_id = course["id"]
        
        progress_data = _calculate_course_progress(db, user_id=member_user_id, course_id=course_id)
        percent = progress_data["percent"]
        
        if percent == 0:
            continue
        
        course_info = {
            "id": course_id,
            "title": course["title"],
            "description": course.get("description"),
            "progress": percent,
            "completed_items": progress_data["completed_items"],
            "total_items": progress_data["total_items"],
            "department": course.get("department"),
            "thumbnail_url": course.get("thumbnail_url"),
        }
        
        if percent >= 100.0:
            completed_courses.append(course_info)
        else:
            in_progress_courses.append(course_info)
    
    member_info = {
        "user_id": member.user_id,
        "user_name": member.user.Name if member.user else None,
        "user_email": member.user.email if member.user else None,
        "role_in_team": member.role_in_team.value if member.role_in_team else None,
    }
    
    total_completed = len(completed_courses)
    total_in_progress = len(in_progress_courses)
    total_courses_started = total_completed + total_in_progress
    
    if total_courses_started > 0:
        overall_progress = round(
            sum(c["progress"] for c in (in_progress_courses + completed_courses)) / total_courses_started,
            2
        )
    else:
        overall_progress = 0.0
    
    total_items_completed = sum(c["completed_items"] for c in (in_progress_courses + completed_courses))
    total_items = sum(c["total_items"] for c in (in_progress_courses + completed_courses))
    
    stats = {
        "total_courses_started": total_courses_started,
        "total_in_progress": total_in_progress,
        "total_completed": total_completed,
        "overall_progress": overall_progress,
        "total_items_completed": total_items_completed,
        "total_items": total_items,
    }
    
    return make_response(True, "Member progress fetched", data={
        "member": member_info,
        "stats": stats,
        "in_progress": in_progress_courses,
        "completed": completed_courses,
    }, status_code=200)

def _calculate_course_progress(db: Session, *, user_id: int, course_id: int):
    """Helper function to calculate course progress for a user"""
    items = content_repo.list_items_for_course(db, course_id=course_id)
    content_ids = [it.id for it in items]
    total_items = len(content_ids)
    
    if total_items == 0:
        return {"course_id": course_id, "completed_items": 0, "total_items": 0, "percent": 0.0}
    
    rows = prog_repo.list_for_user_and_content_ids(db, user_id=user_id, content_ids=content_ids)
    
    completed_ids = {r.content_id for r in rows if r.completed_at is not None or (r.progress or 0) >= 100.0}
    completed_items = len(completed_ids)
    percent = round((completed_items / total_items) * 100.0, 2)
    
    return {
        "course_id": course_id,
        "completed_items": completed_items,
        "total_items": total_items,
        "percent": percent,
    }

# Attachment functions
def upload_announcement_attachment(
    db: Session, 
    *, 
    team_id: int, 
    announcement_id: int, 
    user_id: int,
    file_bytes: bytes,
    filename: str,
    attachment_type: str
):
    """Upload an attachment (image, video, or PDF) to an announcement"""
    if not _is_team_manager(db, team_id=team_id, user_id=user_id):
        return make_response(False, "You must be a team manager", status_code=403, error="Not a manager of this team")
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404, error="Announcement does not exist or does not belong to this team")
    
    if a.author_id != user_id:
        return make_response(False, "Only the announcement author can add attachments", status_code=403, error="User is not the author")
    
    try:
        if attachment_type == "image":
            result = upload_image_bytes(file_bytes)
            att_type = AttachmentType.IMAGE
            thumbnail_url = None
        elif attachment_type == "video":
            result = upload_video_bytes(file_bytes=file_bytes, filename=filename)
            att_type = AttachmentType.VIDEO
            thumbnail_url = result.get("thumbnail_url")
        elif attachment_type == "pdf":
            result = upload_document_bytes(file_bytes=file_bytes, filename=filename, mime_type="application/pdf")
            att_type = AttachmentType.PDF
            thumbnail_url = result.get("thumbnail_url")
        else:
            return make_response(False, "Invalid file type", status_code=400, error="attachment_type must be image, video, or pdf")
        
        attachment = announcements_repo.create_attachment(
            db,
            announcement_id=announcement_id,
            attachment_type=att_type,
            cloudinary_url=result["secure_url"],
            cloudinary_public_id=result["public_id"],
            cloudinary_thumbnail_url=thumbnail_url,
            original_filename=filename,
            size_bytes=result.get("size_bytes")
        )
        
        return make_response(True, "Attachment uploaded successfully", data={
            "id": attachment.id,
            "attachment_type": attachment.attachment_type.value,
            "url": attachment.cloudinary_url,
            "thumbnail_url": attachment.cloudinary_thumbnail_url,
            "filename": attachment.original_filename,
            "size_bytes": attachment.size_bytes,
            "created_at": attachment.created_at
        }, status_code=201)
        
    except Exception as e:
        return make_response(False, "Failed to upload attachment", status_code=500, error=str(e))

def delete_announcement_attachment(
    db: Session,
    *,
    team_id: int,
    announcement_id: int,
    attachment_id: int,
    user_id: int
):
    """Delete an attachment from an announcement"""
    if not _is_team_manager(db, team_id=team_id, user_id=user_id):
        return make_response(False, "You must be a team manager", status_code=403, error="Not a manager of this team")
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404, error="Announcement does not exist or does not belong to this team")
    
    if a.author_id != user_id:
        return make_response(False, "Only the announcement author can delete attachments", status_code=403, error="User is not the author")
    
    attachment = announcements_repo.get_attachment(db, attachment_id=attachment_id)
    if not attachment or attachment.announcement_id != announcement_id:
        return make_response(False, "Attachment not found", status_code=404, error="Attachment does not exist or does not belong to this announcement")
    
    try:
        resource_type = "video" if attachment.attachment_type == AttachmentType.VIDEO else "image"
        delete_with_thumbnail(attachment.cloudinary_public_id, resource_type=resource_type)
        
        announcements_repo.delete_attachment(db, attachment_id=attachment_id)
        
        return make_response(True, "Attachment deleted successfully", status_code=200)
        
    except Exception as e:
        return make_response(False, "Failed to delete attachment", status_code=500, error=str(e))

def list_announcement_attachments(db: Session, *, team_id: int, announcement_id: int, user_id: int):
    """List all attachments for an announcement"""
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "You must be a team member", status_code=403, error="Not a member of this team")
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404, error="Announcement does not exist or does not belong to this team")
    
    attachments = announcements_repo.list_announcement_attachments(db, announcement_id=announcement_id)
    
    serialized = [
        {
            "id": att.id,
            "attachment_type": att.attachment_type.value,
            "url": att.cloudinary_url,
            "thumbnail_url": att.cloudinary_thumbnail_url,
            "filename": att.original_filename,
            "size_bytes": att.size_bytes,
            "created_at": att.created_at
        }
        for att in attachments
    ]
    
    return make_response(True, "Attachments fetched successfully", data=serialized, status_code=200)