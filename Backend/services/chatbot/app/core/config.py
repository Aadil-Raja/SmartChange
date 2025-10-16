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
    llm_model: str 

@lru_cache()
def get_settings() -> Settings:
    return Settings()