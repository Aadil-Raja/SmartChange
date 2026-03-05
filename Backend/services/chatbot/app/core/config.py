from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Databases
    chatbot_database_url: str
    chunk_database_url: str
    management_database_url: str  # For accessing users table

    # Google API (for embeddings only)
    google_api_key: str
    embedding_model: str = "models/gemini-embedding-001"

    # LLM Provider Configuration (for text generation)
    llm_provider: str = "gemini"
    llm_model: str = "gemini-2.5-flash"
    openai_api_key: str | None = None

    # JWT
    jwt_secret: str
    jwt_algorithm: str


@lru_cache()
def get_settings() -> Settings:
    return Settings()