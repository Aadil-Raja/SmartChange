from sqlalchemy.orm import Session
from app.repositories import users_repo

def create_user(db: Session, *, email: str, name: str, password: str):
    if users_repo.get_by_email(db, email):
        raise ValueError("Email already registered")

    return users_repo.create(db, email=email, name=name, password_hash=password)

def list_users(db: Session):
    return users_repo.list_all(db)