from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base
from app.core.config import get_settings

settings = get_settings()

# Use the chatbot DB for this service
engine = create_engine(settings.chatbot_database_url, future=True)

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


        
chunk_engine = create_engine(settings.chunk_database_url, future=True)
ChunkSessionLocal = sessionmaker(bind=chunk_engine, autoflush=False, autocommit=False)

def get_chunk_db():
    db = ChunkSessionLocal()
    try:
        yield db
    finally:
        db.close()
