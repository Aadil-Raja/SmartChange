from sqlalchemy.orm import Session
from  shared.models import  Team, TeamMember, TeamMemberRole

def create_team(db: Session, name: str) -> Team:
    team = Team(name=name)
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
