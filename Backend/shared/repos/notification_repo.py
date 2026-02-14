"""
Repository for notification CRUD operations.
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from shared.models.notification import Notification, NotificationType
from shared.models.user import User
from shared.models.course import Course


def create_notification(
    db: Session,
    *,
    user_id: int,
    type: NotificationType,
    title: str,
    message: str,
    sender_id: Optional[int] = None,
    related_course_id: Optional[int] = None,
    related_team_id: Optional[int] = None
) -> Notification:
    """Create a new notification"""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        sender_id=sender_id,
        related_course_id=related_course_id,
        related_team_id=related_team_id,
        is_read=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def get_notifications_for_user(
    db: Session,
    *,
    user_id: int,
    page: int = 1,
    limit: int = 10,
    unread_only: bool = False
) -> Dict[str, Any]:
    """
    Get paginated notifications for a user.
    
    Returns:
        Dictionary with notifications list, total count, page info, and unread count
    """
    # Base query
    query = db.query(Notification).filter(Notification.user_id == user_id)
    
    # Filter by read status if requested
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    # Get total count
    total = query.count()
    
    # Get unread count (always calculate this)
    unread_count = db.query(Notification).filter(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    ).count()
    
    # Apply pagination and ordering
    notifications = (
        query
        .options(
            joinedload(Notification.sender),
            joinedload(Notification.course),
            joinedload(Notification.team)
        )
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    
    # Calculate total pages
    pages = (total + limit - 1) // limit if total > 0 else 1
    
    return {
        "notifications": notifications,
        "total": total,
        "page": page,
        "pages": pages,
        "unread_count": unread_count
    }


def get_unread_count(db: Session, *, user_id: int) -> int:
    """Get count of unread notifications for a user"""
    return db.query(Notification).filter(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    ).count()


def get_notification_by_id(db: Session, *, notification_id: int, user_id: int) -> Optional[Notification]:
    """Get a specific notification (ensures it belongs to the user)"""
    return db.query(Notification).filter(
        and_(
            Notification.id == notification_id,
            Notification.user_id == user_id
        )
    ).first()


def mark_as_read(db: Session, *, notification_id: int, user_id: int) -> bool:
    """
    Mark a notification as read.
    
    Returns:
        True if notification was marked as read, False if not found
    """
    notification = get_notification_by_id(db, notification_id=notification_id, user_id=user_id)
    if not notification:
        return False
    
    notification.is_read = True
    db.commit()
    return True


def mark_all_as_read(db: Session, *, user_id: int) -> int:
    """
    Mark all notifications as read for a user.
    
    Returns:
        Number of notifications marked as read
    """
    count = db.query(Notification).filter(
        and_(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
    ).update({"is_read": True}, synchronize_session=False)
    
    db.commit()
    return count


def delete_notification(db: Session, *, notification_id: int, user_id: int) -> bool:
    """
    Delete a notification.
    
    Returns:
        True if notification was deleted, False if not found
    """
    notification = get_notification_by_id(db, notification_id=notification_id, user_id=user_id)
    if not notification:
        return False
    
    db.delete(notification)
    db.commit()
    return True


def bulk_create_notifications(
    db: Session,
    *,
    user_ids: List[int],
    type: NotificationType,
    title: str,
    message: str,
    sender_id: Optional[int] = None,
    related_course_id: Optional[int] = None,
    related_team_id: Optional[int] = None
) -> int:
    """
    Create notifications for multiple users at once (for team announcements).
    
    Returns:
        Number of notifications created
    """
    notifications = [
        Notification(
            user_id=user_id,
            type=type,
            title=title,
            message=message,
            sender_id=sender_id,
            related_course_id=related_course_id,
            related_team_id=related_team_id,
            is_read=False
        )
        for user_id in user_ids
    ]
    
    db.bulk_save_objects(notifications)
    db.commit()
    
    return len(notifications)
