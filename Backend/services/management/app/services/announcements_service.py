from sqlalchemy.orm import Session
from app.utils.response_utils import make_response
from app.repositories import announcements_repo
from shared.models import TeamMember, TeamMemberRole, Announcement
from app.repositories import progress_repo as prog_repo
from app.repositories import courseContent_repo as content_repo
from app.services import courseContent_service

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

def list_team_announcements(db: Session, *, team_id: int, user_id: int):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)

    arr = announcements_repo.list_team_announcements(db, team_id=team_id)

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
        for a in arr
    ]

    return make_response(True, "Announcements fetched", data=serialized, status_code=200)

def get_announcement_with_comments(db: Session, *, team_id: int, announcement_id: int, user_id: int):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    comments = [
        {
            "id": c.id,
            "announcement_id": c.announcement_id,
            "body": c.body,
            "created_at": c.created_at,
            "user_name": c.user.Name if c.user else None,
            "can_delete": c.user_id == user_id,
        }
        for c in a.comments
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
        "comments": comments,
    }
    return make_response(True, "Announcement fetched", data=data, status_code=200)

def update_announcement(db: Session, *, team_id: int, announcement_id: int, user_id: int, title: str | None, body: str | None):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    
    # Only the author can update the announcement
    if a.author_id != user_id:
        return make_response(False, "Only the author can update this announcement", status_code=403)
    
    # At least one field must be provided
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
    
    # Only the author can delete the announcement
    if a.author_id != user_id:
        return make_response(False, "Only the author can delete this announcement", status_code=403)
    
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
    
    # Get the comment
    comment = announcements_repo.get_comment(db, comment_id=comment_id)
    if not comment or comment.announcement_id != announcement_id:
        return make_response(False, "Comment not found", status_code=404)
    
    # Only the commentator can delete their own comment
    if comment.user_id != user_id:
        return make_response(False, "Only the commentator can delete this comment", status_code=403)
    
    announcements_repo.delete_comment(db, comment_id=comment_id)
    
    return make_response(True, "Comment deleted", status_code=200)

def list_team_members(db: Session, *, team_id: int, user_id: int):
    if not _is_team_manager(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Only team managers can view team members", status_code=403)
    
    members = announcements_repo.get_team_members(db, team_id=team_id)
    
    serialized = [
        {
            "id": m.id,
            "user_id": m.user_id,
            "user_name": m.user.Name if m.user else None,
            "user_email": m.user.email if m.user else None,
            "role_in_team": m.role_in_team.value if m.role_in_team else None,
            "joined_at": m.created_at,
        }
        for m in members
    ]
    
    return make_response(True, "Team members fetched", data=serialized, status_code=200)

def get_member_progress_overview(db: Session, *, team_id: int, manager_id: int, member_user_id: int):
    """
    Get progress overview for a specific team member (manager only).
    Returns in_progress and completed courses (excludes starred).
    """
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