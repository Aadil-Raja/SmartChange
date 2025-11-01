from sqlalchemy.orm import Session
from app.utils.response_utils import make_response
from app.repositories import announcements_repo
from shared.models import TeamMember, TeamMemberRole, Announcement

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
    # visible only to members of that team
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)

    arr = announcements_repo.list_team_announcements(db, team_id=team_id)

    # Replace author_id with author_name
    serialized = [
        {
            "id": a.id,
            "title": a.title,
            "body": a.body,
            "created_at": a.created_at,
            "team_id": a.team_id,
            "author_name": a.author.Name if a.author else None,  # << here
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
    # Serialize comments to include user name

    comments = [
        {
            "id": c.id,
            "announcement_id": c.announcement_id,
            "user_id": c.user_id,
            "body": c.body,
            "created_at": c.created_at,
            "user_name": c.user.Name if c.user else None,
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
    } 
    data = {
        "announcement": a_serialized,
        "comments": comments,
    }
    return make_response(True, "Announcement fetched", data=data, status_code=200)

def add_comment(db: Session, *, team_id: int, announcement_id: int, user_id: int, body: str):
    if not _is_team_member(db, team_id=team_id, user_id=user_id):
        return make_response(False, "Not a member of this team", status_code=403)
    a = announcements_repo.get_announcement(db, announcement_id=announcement_id)
    if not a or a.team_id != team_id:
        return make_response(False, "Announcement not found", status_code=404)
    c = announcements_repo.add_comment(db, announcement_id=announcement_id, user_id=user_id, body=body)
    return make_response(True, "Comment added", data=c, status_code=201)
