# app/repositories/employees_repo.py
from sqlalchemy.orm import Session
from shared.models import User, UserRole, TeamMember, Team

def list_non_admin_users(db: Session):
    """
    Fetch all users except admins, with optional team info.
    Ordered by user.id ascending.
    """
    query = (
        db.query(
            User,
            Team.id.label("team_id"),                 # ✅ add team_id
            Team.name.label("team_name"),
            TeamMember.role_in_team,
        )
        .outerjoin(TeamMember, TeamMember.user_id == User.id)
        .outerjoin(Team, Team.id == TeamMember.team_id)
        .filter(User.role != UserRole.admin)
        .order_by(User.id.asc())
    )
    return query.all()
