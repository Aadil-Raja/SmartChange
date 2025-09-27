# SHARED: Configuration management using Pydantic BaseSettings
# This configuration is used across all services for environment variable management

from pydantic import BaseSettings, Field
from typing import Optional
import os

class Settings(BaseSettings):
    """Shared settings class for all services"""
    
    # Database settings
    database_url: str = Field(..., env="DATABASE_URL")
    
    # JWT settings
    jwt_secret: str = Field(..., env="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=30, env="JWT_EXPIRE_MINUTES")
    
    # API settings
    api_v1_prefix: str = Field(default="/api/v1", env="API_V1_PREFIX")
    project_name: str = Field(default="SmartChange API", env="PROJECT_NAME")
    
    # CORS settings
    cors_origins: list = Field(default=["http://localhost:3000"], env="CORS_ORIGINS")
    
    # Logging settings
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
_settings: Optional[Settings] = None

def get_settings() -> Settings:
    """Get the global settings instance"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
