from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app.core.config import get_settings

settings = get_settings()

# Use the chatbot DB for this service
engine = create_engine(
    settings.chatbot_database_url,
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

def init_db():
    """Creates all tables in chatbot DB"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


        
chunk_engine = create_engine(
    settings.chunk_database_url,
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
ChunkSessionLocal = sessionmaker(bind=chunk_engine, autoflush=False, autocommit=False)

def get_chunk_db():
    db = ChunkSessionLocal()
    try:
        yield db
    finally:
        db.close()
