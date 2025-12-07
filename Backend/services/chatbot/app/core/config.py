from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )
    chatbot_database_url: str
    chunk_database_url: str
    google_api_key: str
    rag_google_api_key: str | None = None  # Optional separate key for RAG/embeddings
    summary_google_api_key: str | None = None  # Optional separate key for document summaries
    llm_model: str 
    jwt_secret: str
    jwt_algorithm: str

@lru_cache()
def get_settings() -> Settings:
    return Settings()