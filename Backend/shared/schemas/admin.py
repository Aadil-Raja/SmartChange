from pydantic import BaseModel, EmailStr
from datetime import datetime
from enum import Enum


# ---------- Auth (admin) ----------

class AdminLoginIn(BaseModel):
    email: EmailStr
    password: str





# ---------- Teams ----------

class TeamCreate(BaseModel):
    name: str


class TeamUpdate(BaseModel):
    name: str


class TeamOut(BaseModel):
    id: int
    name: str

    created_at: datetime

    class Config:
        from_attributes = True


class RoleInTeam(str, Enum):
    member = "member"
    manager = "manager"


class TeamMemberAdd(BaseModel):
    user_id: int
    role_in_team: RoleInTeam


class TeamMemberBrief(BaseModel):
    user_id: int
    role_in_team: RoleInTeam

    class Config:
        from_attributes = True


class TeamWithMembers(BaseModel):
    team: TeamOut
    members: list[TeamMemberBrief]

class TeamMemberRoleUpdate(BaseModel):
    """
    Schema for updating a user's role within a specific team.
    """
    role_in_team:  RoleInTeam
