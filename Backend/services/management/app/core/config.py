from pydantic_settings import BaseSettings

from functools import lru_cache

class Settings(BaseSettings):
    project_name: str = "SmartChange Management API"
    database_url: str

    class Config:
        env_file = ".env"  # loads from services/management/.env

@lru_cache()
def get_settings():
    return Settings()
