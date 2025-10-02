from sqlalchemy.orm import Session
from shared.models import User

def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def create(db: Session, *, email: str, name: str, password_hash: str | None = None) -> User:
    user = User(email=email, name=name, password_hash=password_hash, email_verified=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def list_all(db: Session):
    return db.query(User).all()

def upsert_verified_user(db: Session, *, email: str, name: str | None = None) -> User:
    user = get_by_email(db, email)
    if user:
        user.email_verified = True
        if name and not user.name:
            user.name = name
    else:
        user = User(email=email, name=name, auth_provider="local", email_verified=True)
        db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).get(user_id)