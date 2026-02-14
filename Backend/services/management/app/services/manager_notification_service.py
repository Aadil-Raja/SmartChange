"""
Manager notification service for sending direct messages to team members.
"""
from sqlalchemy.orm import Session
from typing import Optional
from app.utils.response_utils import make_response
from shared.repos import notification_repo
from shared.models.notification import NotificationType
from shared.models import TeamMember, TeamMemberRole, Course


def _is_team_manager(db: Session, *, team_id: int, user_id: int) -> bool:
    """Check if user is a manager of the team"""
    tm = db.query(TeamMember.role_in_team).filter_by(
        team_id=team_id, 
        user_id=user_id
    ).first()
    return bool(tm and tm[0] == TeamMemberRole.manager)


def _is_team_member(db: Session, *, team_id: int, user_id: int) -> bool:
    """Check if user is a member of the team"""
    return db.query(TeamMember.id).filter_by(
        team_id=team_id, 
        user_id=user_id
    ).first() is not None


def send_direct_message(
    db: Session,
    *,
    team_id: int,
    sender_id: int,
    recipient_user_id: int,
    title: str,
    message: str,
    related_course_id: Optional[int] = None
):
    """
    Send a direct message from manager to team member.
    
    Args:
        db: Database session
        team_id: Team ID (for verification)
        sender_id: Manager's user ID
        recipient_user_id: Employee's user ID
        title: Message title
        message: Message content
        related_course_id: Optional course to link
    
    Returns:
        Response with success/error
    """
    # 1. Verify sender is manager of team
    if not _is_team_manager(db, team_id=team_id, user_id=sender_id):
        return make_response(
            False, 
            "Only team managers can send messages", 
            status_code=403
        )
    
    # 2. Verify recipient is member of team
    if not _is_team_member(db, team_id=team_id, user_id=recipient_user_id):
        return make_response(
            False, 
            "Recipient is not a member of this team", 
            status_code=404
        )
    
    # 3. Prevent self-messaging
    if sender_id == recipient_user_id:
        return make_response(
            False, 
            "Cannot send message to yourself", 
            status_code=400
        )
    
    # 4. Verify course exists if provided
    if related_course_id:
        course = db.query(Course).filter(Course.id == related_course_id).first()
        if not course:
            return make_response(
                False, 
                "Course not found", 
                status_code=404
            )
    
    # 5. Create notification
    try:
        notification = notification_repo.create_notification(
            db,
            user_id=recipient_user_id,
            type=NotificationType.DIRECT_MESSAGE,
            title=title,
            message=message,
            sender_id=sender_id,
            related_course_id=related_course_id,
            related_team_id=team_id
        )
        
        return make_response(
            True, 
            "Message sent successfully", 
            data={
                "notification_id": notification.id,
                "recipient_user_id": recipient_user_id
            },
            status_code=201
        )
    except Exception as e:
        return make_response(
            False, 
            "Failed to send message", 
            status_code=500, 
            error=str(e)
        )
