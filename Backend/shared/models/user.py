from sqlalchemy import Column, Integer, String, Boolean, DateTime, func
from sqlalchemy.orm import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)

    # Password is optional for Firebase/OTP users
    password_hash = Column(String, nullable=True)

    # Firebase UID (only for Firebase accounts)
    firebase_uid = Column(String, unique=True, nullable=True, index=True)

    # New fields for auth flow
    auth_provider = Column(String, default="local", nullable=False)  # "local" | "google"
    email_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="student")

    # 🔑 Token version for revoking JWTs (login + reset flows)
    token_version = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
