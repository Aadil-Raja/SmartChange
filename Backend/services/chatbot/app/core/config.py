from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Databases
    chatbot_database_url: str  # For chat messages and chat heads
    management_database_url: str  # For documents, chunks, sections, users, etc.

    # Google API (for embeddings only)
    google_api_key: str
    embedding_model: str = "models/gemini-embedding-001"

    # LLM Provider Configuration (for text generation)
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    openai_api_key: str | None = None

    # Chatbot limits
    max_active_documents: int = 5
    max_chunks_per_doc: int = 20  # ✅ Changed from 5 to 10

    # Token quota defaults (must match management service defaults)
    default_token_limit: int = 100000
    default_reset_interval_hours: int = 24

    # JWT
    jwt_secret: str
    jwt_algorithm: str


@lru_cache()
def get_settings() -> Settings:
    return Settings()