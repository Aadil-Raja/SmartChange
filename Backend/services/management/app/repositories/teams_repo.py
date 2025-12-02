from sqlalchemy.orm import Session
from shared.models import Team, TeamMember, TeamMemberRole, Announcement, AnnouncementAttachment, AttachmentType
import random
def _generate_unique_code(db: Session) -> str:
    """Generate a unique 6-digit team join code."""
    while True:
        code = f"{random.randint(0, 999999):06d}"
        if not db.query(Team).filter_by(join_code=code).first():
            return code
        
def create_team(db: Session, name: str) -> Team:
    code = _generate_unique_code(db)
    team = Team(name=name, join_code=code)
    db.add(team); db.commit(); db.refresh(team)
    return team

def list_teams(db: Session):
    return db.query(Team).all()

def get_team(db: Session, id: int) -> Team | None:
    return db.query(Team).filter(Team.id == id).first()

def add_member(db: Session, team_id: int, user_id: int, role_in_team: TeamMemberRole) -> TeamMember:
    tm = TeamMember(team_id=team_id, user_id=user_id, role_in_team=role_in_team)
    db.add(tm); db.commit(); db.refresh(tm)
    return tm

def remove_member(db: Session, team_id: int, user_id: int):
    db.query(TeamMember).filter_by(team_id=team_id, user_id=user_id).delete()
    db.commit()

def get_team_with_members(db: Session, id: int):
    return db.query(Team).filter(Team.id == id).first()


def get_teams_for_user(db: Session, user_id: int):
    return (
        db.query(Team, TeamMember.role_in_team)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .filter(TeamMember.user_id == user_id)
        .all()
    )

def update_team(db: Session, id: int, name: str) -> Team | None:
    team = db.query(Team).filter(Team.id == id).first()
    if not team:
        return None
    team.name = name
    db.commit()
    db.refresh(team)
    return team

def delete_team(db: Session, id: int) -> bool:
    from app.services.storage.storage_cloudinary import delete_with_thumbnail
    
    team = db.query(Team).filter(Team.id == id).first()
    if not team:
        return False
    
    # Delete all Cloudinary attachments for announcements in this team
    try:
        announcements = db.query(Announcement).filter(Announcement.team_id == id).all()
        for announcement in announcements:
            attachments = db.query(AnnouncementAttachment).filter(
                AnnouncementAttachment.announcement_id == announcement.id
            ).all()
            
            for attachment in attachments:
                try:
                    resource_type = "video" if attachment.attachment_type == AttachmentType.VIDEO else "image"
                    delete_with_thumbnail(attachment.cloudinary_public_id, resource_type=resource_type)
                except Exception as e:
                    print(f"Warning: Failed to delete attachment {attachment.id} from Cloudinary: {e}")
    except Exception as e:
        print(f"Warning: Failed to cleanup Cloudinary attachments for team {id}: {e}")
    
    # Delete team (cascade will handle DB records)
    db.delete(team)
    db.commit()
    return True
