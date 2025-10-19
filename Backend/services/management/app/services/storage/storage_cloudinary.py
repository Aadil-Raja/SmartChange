# app/services/cloudinary_service.py
import io
import cloudinary
import cloudinary.uploader
from app.core.config import get_settings

settings = get_settings()

# Only configure Cloudinary if credentials are provided
if settings.cloudinary_cloud_name and settings.cloudinary_api_key and settings.cloudinary_api_secret:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )
    _cloudinary_configured = True
else:
    _cloudinary_configured = False


def upload_raw_bytes(file_bytes: bytes, public_id: str | None = None):
    """
    Upload bytes to Cloudinary in the default folder from env.
    Returns secure_url and public_id.
    
    Raises:
        RuntimeError: If Cloudinary is not configured
    """
    if not _cloudinary_configured:
        raise RuntimeError(
            "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file."
        )
    
    result = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        resource_type="raw",
        folder=settings.cloudinary_folder,
        public_id=public_id,
        overwrite=True,
        unique_filename=True,
    )
    return {
        "secure_url": result.get("secure_url"),
        "public_id": result.get("public_id"),
    }
