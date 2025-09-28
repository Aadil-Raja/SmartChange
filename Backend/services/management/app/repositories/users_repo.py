from sqlalchemy.orm import Session
from shared.models.user import User

def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def create(db: Session, *, email: str, name: str, password_hash: str ) -> User:
    user = User(email=email, name=name, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_all(db: Session):
    return db.query(User).all()
