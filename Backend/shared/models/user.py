from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, func
from sqlalchemy.orm import declarative_base
import enum

Base = declarative_base()

class UserRole(enum.Enum):
    employee = "employee"
    manager = "manager"
    admin = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)

    password_hash = Column(String, nullable=True)
    firebase_uid = Column(String, unique=True, nullable=True, index=True)
    auth_provider = Column(String, default="local", nullable=False)  # "local" | "google"
    email_verified = Column(Boolean, default=False)

    # 🔽 explicit enum name so Alembic/Postgres agree
    role = Column(
        Enum(UserRole, name="user_role", create_type=True),
        nullable=False,
        server_default=UserRole.employee.value,  # helps existing rows on migrate
    )

    token_version = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
