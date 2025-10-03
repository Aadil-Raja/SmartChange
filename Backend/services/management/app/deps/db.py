from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models.user import Base
from app.core.config import get_settings

settings = get_settings()


# Create engine from .env DATABASE_URL
engine = create_engine(settings.database_url, future=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

# Create tables in DB
def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
