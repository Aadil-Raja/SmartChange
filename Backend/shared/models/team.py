from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Enum,
    UniqueConstraint, Index, func
)
from sqlalchemy.orm import relationship
import enum


from .user import Base

class TeamMemberRole(enum.Enum):
    member = "member"
    manager = "manager"

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, unique=True, index=True)
    join_code = Column(String(6), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # relationships
    members = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True)

    team_id = Column(
        Integer,
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role_in_team = Column(
        Enum(TeamMemberRole, name="team_member_role", create_type=True),
        nullable=False,
        server_default=TeamMemberRole.member.value,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    team = relationship("Team", back_populates="members")
    user = relationship("User")  # if you have backref on User, you can add it there

    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_member_team_user"),
        Index("ix_team_members_user_team", "user_id", "team_id"),
    )
