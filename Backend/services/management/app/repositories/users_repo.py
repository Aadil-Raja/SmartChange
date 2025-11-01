from sqlalchemy.orm import Session
from shared.models import User

def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()

def create(db: Session, *, email: str, password_hash: str | None = None,role: str | None = None) -> User:
    user = User(email=email, password_hash=password_hash, email_verified=True,role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def list_all(db: Session):
    return db.query(User).all()



def get_by_firebase_uid(db: Session, uid: str) -> User | None:
    return db.query(User).filter(User.firebase_uid == uid).first()

def get_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).get(user_id)


def upsert_from_firebase(db: Session, *, email: str, uid: str,name : str) -> User:
    """
    Find user by email; if missing, create minimal row.
    Attach firebase_uid if not already set.
    Mark email_verified=True (Google verifies it).
    """
    user = get_by_email(db, email)
    if user is None:
        user = User(
            email=email,
            password_hash=None,          # no local password for Google-only accounts
            auth_provider="google",
            email_verified=True,         # Google verified
            firebase_uid=uid,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    changed = False
    # Attach UID if first-time Google sign-in for an existing local account
    if not user.firebase_uid:
        user.firebase_uid = uid
        changed = True

    # Trust Google verification
    if not user.email_verified:
        user.email_verified = True
        changed = True

    # Flip provider if you want to reflect latest method
    if user.auth_provider != "google":
        user.auth_provider = "google"
        changed = True

    if not user.Name and name:
        user.name = name
        changed = True
        
    if changed:
        db.commit()
        db.refresh(user)

    return user