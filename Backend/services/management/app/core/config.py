from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )

    project_name: str = "SmartChange Management API"
    database_url: str
   
    jwt_secret: str
    jwt_algorithm: str = "HS256"

   

@lru_cache()
def get_settings() -> Settings:
    return Settings()