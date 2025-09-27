# APP-API SERVICE: Database dependencies
# This file contains database session management for the app-api service

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import sys
import os

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))

from shared.core.config import get_settings
from shared.models.user import Base as UserBase
from shared.models.document import Base as DocumentBase

settings = get_settings()

# Create database engine
engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables
Base = declarative_base()

async def init_db():
    """Initialize database tables"""
    # Import all models to ensure they are registered
    from shared.models.user import User
    from shared.models.document import Document
    
    # Create all tables
    Base.metadata.create_all(bind=engine)

def get_db() -> Session:
    """Get database session dependency"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()