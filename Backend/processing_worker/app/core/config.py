"""
Configuration loader - loads environment variables and provides settings.
Loaded once at startup and reused across modules.
"""

import os
from typing import Optional
from dotenv import load_dotenv, find_dotenv

# Load .env file
load_dotenv(find_dotenv())


class Settings:
    """Application settings from environment variables."""
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Google AI
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "models/text-embedding-004")
    EMBEDDING_DIMENSION: int = int(os.getenv("EMBEDDING_DIMENSION", "768"))
    
    # Chunking
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "512"))  # tokens
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "50"))  # tokens
    MIN_CHUNK_SIZE: int = int(os.getenv("MIN_CHUNK_SIZE", "100"))  # tokens
    USE_SEMANTIC_CHUNKING: bool = os.getenv("USE_SEMANTIC_CHUNKING", "true").lower() == "true"
    
    # Embeddings
    EMBEDDING_BATCH_SIZE: int = int(os.getenv("EMBEDDING_BATCH_SIZE", "100"))
    EMBEDDING_MAX_RETRIES: int = int(os.getenv("EMBEDDING_MAX_RETRIES", "3"))
    
    # Storage
    STORAGE_TYPE: str = os.getenv("STORAGE_TYPE", "local")  # local, s3
    STORAGE_LOCAL_PATH: str = os.getenv("STORAGE_LOCAL_PATH", "./uploads")
    
    # Redis (for RQ)
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    def validate(self) -> bool:
        """
        Validate that required settings are present.
        
        Returns:
            True if valid, raises ValueError if not
        """
        errors = []
        
        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required")
        
        if not self.GOOGLE_API_KEY:
            errors.append("GOOGLE_API_KEY is required")
        
        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")
        
        return True


# Global settings instance
settings = Settings()

# Validate on import
try:
    settings.validate()
except ValueError as e:
    print(f"⚠️  Configuration Warning: {e}")
    print("Set missing environment variables in .env file")


def get_settings() -> Settings:
    """
    Get settings instance.
    
    Returns:
        Settings object
    """
    return settings