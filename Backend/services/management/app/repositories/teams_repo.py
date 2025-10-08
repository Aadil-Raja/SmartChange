from sqlalchemy.orm import Session
from  shared.models import  Team, TeamMember, TeamMemberRole
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
