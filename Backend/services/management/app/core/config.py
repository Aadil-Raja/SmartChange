from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from pathlib import Path
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )
    
    project_name: str = "SmartChange Management API"
    database_url: str
    allowed_domains_raw: str = ""
    jwt_algorithm: str = "HS256"
    jwt_secret: str
    mail_username: str
    mail_password: str
    mail_from: str
    mail_port: int = 587
    mail_server: str = "smtp.gmail.com"
    mail_from_name: str = "Your App Name"
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    use_credentials: bool = True
    validate_certs: bool = True
    reset_password_url: str = "http://localhost:5173/reset-password"
    firebase_credentials_file: str
    init_admin_email: str | None = None
    init_admin_password: str | None = None

    storage_backend: str               
    storage_local_root: str 
    storage_bucket: str 
   
    redis_url : str
    queue_backend : str
    queue_name : str
    rq_process_task : str
    
    # Cloudinary (optional - for cloud storage)
    cloudinary_cloud_name: str | None = None
    cloudinary_api_key: str | None = None
    cloudinary_api_secret: str | None = None
    cloudinary_folder: str | None = None
    
    # Google AI for topic generation
    google_api_key: str | None = None
    llm_model: str = "gemini-2.5-flash"

@lru_cache()
def get_settings() -> Settings:
    return Settings()