from sqlalchemy.orm import Session, joinedload
from shared.models import Announcement, AnnouncementComment, TeamMember


def create_announcement(db: Session, *, team_id: int, author_id: int, title: str, body: str) -> Announcement:
    a = Announcement(team_id=team_id, author_id=author_id, title=title.strip(), body=body.strip())
    db.add(a); db.commit(); db.refresh(a)
    return a

def list_team_announcements(db: Session, *, team_id: int) -> list[Announcement]:
    return db.query(Announcement).filter(Announcement.team_id == team_id).order_by(Announcement.id.desc()).all()

def get_announcement(db: Session, *, announcement_id: int) -> Announcement | None:
    return db.query(Announcement).filter(Announcement.id == announcement_id).first()

def add_comment(db: Session, *, announcement_id: int, user_id: int, body: str) -> AnnouncementComment:
    c = AnnouncementComment(announcement_id=announcement_id, user_id=user_id, body=body.strip())
    db.add(c); db.commit(); db.refresh(c)
    return c



def get_team_members(db: Session, *, team_id: int) -> list[TeamMember]:
    return (
        db.query(TeamMember)
        .filter(TeamMember.team_id == team_id)
        .order_by(TeamMember.role_in_team.desc(), TeamMember.created_at.asc())
        .all()
    )