from sqlalchemy.orm import Session
from app.core.config import get_settings
from shared.repos import users_repo
from passlib.context import CryptContext

settings = get_settings()
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_superadmin(db: Session):
    if not settings.init_admin_email or not settings.init_admin_password:
        return  # nothing configured

    existing = users_repo.get_by_email(db, settings.init_admin_email)
    if existing:
        return  # already present

    password_hash = pwd_ctx.hash(settings.init_admin_password)
    users_repo.create(
        db,
        email=settings.init_admin_email,
        password_hash=password_hash,
        role="admin"
    )
    print(f"✅ Seeded superadmin: {settings.init_admin_email}")
