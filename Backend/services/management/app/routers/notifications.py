"""
Notification endpoints for employees.
"""
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.deps.db import get_db
from app.deps.auth import get_current_user
from app.utils.response_utils import make_response
from shared.repos import notification_repo
from shared.schemas.notification import NotificationOut, NotificationListResponse, UnreadCountResponse, SendDirectMessageIn
from app.services import manager_notification_service


router = APIRouter()


@router.get("/notifications", status_code=status.HTTP_200_OK)
def get_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    unread_only: bool = Query(False),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Get paginated notifications for current user.
    
    Query params:
    - page: Page number (default: 1)
    - limit: Items per page (default: 10, max: 100)
    - unread_only: Show only unread notifications (default: false)
    """
    try:
        result = notification_repo.get_notifications_for_user(
            db,
            user_id=user.id,
            page=page,
            limit=limit,
            unread_only=unread_only
        )
        
        # Format notifications with sender, course, and team info
        notifications_out = []
        for notif in result["notifications"]:
            notif_dict = {
                "id": notif.id,
                "type": notif.type,
                "title": notif.title,
                "message": notif.message,
                "is_read": notif.is_read,
                "created_at": notif.created_at,
                "sender_id": notif.sender_id,
                "sender_name": notif.sender.Name if notif.sender else None,
                "related_course_id": notif.related_course_id,
                "related_course_title": notif.course.title if notif.course else None,
                "related_team_id": notif.related_team_id,
                "related_team_name": notif.team.name if notif.team else None
            }
            notifications_out.append(notif_dict)
        
        response_data = {
            "notifications": notifications_out,
            "total": result["total"],
            "page": result["page"],
            "pages": result["pages"],
            "unread_count": result["unread_count"]
        }
        
        return make_response(True, "Notifications fetched successfully", data=response_data)
    except Exception as e:
        return make_response(False, "Failed to fetch notifications", status_code=500, error=str(e))


@router.get("/notifications/unread-count", status_code=status.HTTP_200_OK)
def get_unread_count(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Get count of unread notifications for current user.
    """
    try:
        count = notification_repo.get_unread_count(db, user_id=user.id)
        return make_response(True, "Unread count fetched successfully", data={"unread_count": count})
    except Exception as e:
        return make_response(False, "Failed to fetch unread count", status_code=500, error=str(e))


@router.patch("/notifications/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_notification_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Mark a specific notification as read.
    """
    try:
        success = notification_repo.mark_as_read(
            db,
            notification_id=notification_id,
            user_id=user.id
        )
        
        if not success:
            return make_response(False, "Notification not found", status_code=404)
        
        return make_response(True, "Notification marked as read")
    except Exception as e:
        return make_response(False, "Failed to mark notification as read", status_code=500, error=str(e))


@router.patch("/notifications/mark-all-read", status_code=status.HTTP_200_OK)
def mark_all_notifications_as_read(
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Mark all notifications as read for current user.
    """
    try:
        count = notification_repo.mark_all_as_read(db, user_id=user.id)
        return make_response(
            True,
            "All notifications marked as read",
            data={"marked_count": count}
        )
    except Exception as e:
        return make_response(False, "Failed to mark all notifications as read", status_code=500, error=str(e))


@router.delete("/notifications/{notification_id}", status_code=status.HTTP_200_OK)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Delete a notification.
    """
    try:
        success = notification_repo.delete_notification(
            db,
            notification_id=notification_id,
            user_id=user.id
        )
        
        if not success:
            return make_response(False, "Notification not found", status_code=404)
        
        return make_response(True, "Notification deleted")
    except Exception as e:
        return make_response(False, "Failed to delete notification", status_code=500, error=str(e))


# ============ MANAGER ENDPOINTS ============

@router.post("/manager/notifications/send-message", status_code=status.HTTP_201_CREATED)
def send_direct_message_to_employee(
    payload: SendDirectMessageIn,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Send a direct message from manager to team member.
    
    Body:
    - team_id: Team ID (for verification)
    - recipient_user_id: Employee to send message to
    - title: Message title
    - message: Message content
    - related_course_id: Optional course link
    
    Returns:
    - Success message with notification ID
    """
    try:
        return manager_notification_service.send_direct_message(
            db,
            team_id=payload.team_id,
            sender_id=user.id,
            recipient_user_id=payload.recipient_user_id,
            title=payload.title,
            message=payload.message,
            related_course_id=payload.related_course_id
        )
    except Exception as e:
        return make_response(
            False, 
            "Failed to send message", 
            status_code=500, 
            error=str(e)
        )
