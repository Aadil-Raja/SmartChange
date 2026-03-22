"""
Configuration loader - loads environment variables and provides settings.
Loaded once at startup and reused across modules.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )
    
    # Database
    database_url: str
    
    # Google AI (for embeddings only)
    google_api_key: str
    embedding_model: str = "models/gemini-embedding-001"
    embedding_dimension: int = 3072
    
    # LLM Provider Configuration (for quiz & document text generation)
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    openai_api_key: str | None = None
    
    # Chunking
    chunk_size: int = 512  # tokens
    chunk_overlap: int = 50  # tokens
    min_chunk_size: int = 100  # tokens
    
    # Embeddings
    embedding_batch_size: int = 100
    embedding_max_retries: int = 3
    
    # Storage
    storage_type: str = "local"  # local, s3
    storage_local_path: str = "./uploads"
    
    # Redis (for RQ)
    redis_url: str = "redis://localhost:6379/0"
    queue_name: str = "default"
    
    # Logging
    log_level: str = "INFO"


@lru_cache()
def get_settings() -> Settings:
    """
    Get settings instance.
    
    Returns:
        Settings object
    """
    return Settings()