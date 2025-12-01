from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from shared.models.user import Base
from app.core.config import get_settings

settings = get_settings()


# Create engine from .env DATABASE_URL
engine = create_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,  # Test connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=5,         # Connection pool size
    max_overflow=10,     # Max overflow connections
    connect_args={
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
)

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
