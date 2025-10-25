# app/services/cloudinary_service.py
import io
import cloudinary
import cloudinary.uploader
from app.core.config import get_settings
from cloudinary.utils import cloudinary_url

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


def delete_file_by_public_id(public_id: str):
    """
    Delete a file from Cloudinary by its public ID.
    """
    try:
        cloudinary.uploader.destroy(public_id)
    except Exception as e:
        print(f"[delete_file_by_public_id] Failed to delete: {e}")



def upload_video_bytes(*, file_bytes: bytes, filename: str | None = None, folder: str | None = None):
    """
    Upload MP4 (or other video) to Cloudinary and return metadata we store in DB.
    """
    res = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        resource_type="video",
        folder=settings.cloudinary_folder,
        overwrite=True,
        unique_filename=True,
        type="upload",
    )
    
    public_id = res["public_id"]
    secure_url = res["secure_url"]
    duration_sec = int(res.get("duration", 0))
    size_bytes = int(res.get("bytes", 0))
    
    # Create a poster image (jpg) from 1s
    thumb_url, _ = cloudinary_url(
        public_id,
        resource_type="video",
        format="jpg",
        start_offset="1",
        transformation={"width": 480},
        secure=True,
    )
    
    return {
        "public_id": public_id,
        "secure_url": secure_url,
        "thumbnail_url": thumb_url,
        "duration_sec": duration_sec,
        "size_bytes": size_bytes,
    }

def delete_video_from_cloudinary(public_id: str):
    """
    Delete a video from Cloudinary by its public_id.
    Resource type must be 'video' for video files.
    """
    result = cloudinary.uploader.destroy(public_id, resource_type="video")
    return result