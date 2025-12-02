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

def upload_document_bytes(*, file_bytes: bytes, filename: str | None = None, mime_type: str | None = None):
    """
    Upload PDF document to Cloudinary and return metadata with thumbnail URL.
    Uploads PDF as image resource type to enable thumbnail generation.
    
    Args:
        file_bytes: Document content as bytes
        filename: Original filename (optional)
        mime_type: MIME type of the document (optional, should be application/pdf)
    
    Returns:
        Dictionary with public_id, secure_url, thumbnail_url, and size_bytes
    
    Raises:
        RuntimeError: If Cloudinary is not configured
    """
    if not _cloudinary_configured:
        raise RuntimeError(
            "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, "
            "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file."
        )
    
    # Upload PDF as "image" resource type to enable page transformations
    res = cloudinary.uploader.upload(
        io.BytesIO(file_bytes),
        resource_type="image",  # Changed from "raw" to "image" for PDF thumbnail support
        folder=settings.cloudinary_folder,
        overwrite=True,
        unique_filename=True,
        type="upload",
        format="pdf",  # Specify it's a PDF
    )
    
    public_id = res["public_id"]
    size_bytes = int(res.get("bytes", 0))
    
    # Generate proper PDF viewing URL (keep the PDF format)
    pdf_url, _ = cloudinary_url(
        public_id,
        resource_type="image",
        format="pdf",
        secure=True,
    )
    
    # Generate thumbnail from first page of PDF
    thumb_url = None
    try:
        thumb_url, _ = cloudinary_url(
            public_id,
            resource_type="image",
            format="jpg",
            page=1,
            transformation={"width": 480, "crop": "limit"},
            secure=True,
        )
        print(f"[upload_document_bytes] Generated thumbnail URL: {thumb_url}")
    except Exception as e:
        print(f"[upload_document_bytes] Failed to generate PDF thumbnail: {e}")

    
    return {
        "public_id": public_id,
        "secure_url": pdf_url,  # Use generated PDF URL instead of res["secure_url"]
        "thumbnail_url": thumb_url,
        "size_bytes": size_bytes,
    }
def delete_document_from_cloudinary(public_id: str, resource_type: str = "raw"):
    """
    Delete a document from Cloudinary by its public_id.
    
    Args:
        public_id: The Cloudinary public ID
        resource_type: Resource type (raw, image, etc.)
    
    Returns:
        Cloudinary API response
    """
    result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
    return result


def delete_with_thumbnail(public_id: str, resource_type: str):
    """
    Delete a file from Cloudinary. Thumbnail is automatically invalidated.
    Works for videos, PDFs, and images.
    
    For videos: resource_type="video"
    For PDFs: resource_type="image" (PDFs are uploaded as image type for thumbnail support)
    For images: resource_type="image"
    
    Note: Thumbnails are transformation URLs, not separate files.
    Deleting the source file with invalidate=True clears CDN cache.
    
    Args:
        public_id: The Cloudinary public ID
        resource_type: Resource type ("video" for videos, "image" for PDFs and images)
    
    Returns:
        Cloudinary API response
    """
    result = cloudinary.uploader.destroy(
        public_id, 
        resource_type=resource_type,
        invalidate=True  # Clear CDN cache for all transformations (thumbnails)
    )
    return result



def upload_image_bytes(file_bytes: bytes, public_id: str | None = None):
    """
    Upload image bytes (PNG/JPG) to Cloudinary.
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
        resource_type="image",  # Changed from "raw" to "image"
        folder=settings.cloudinary_folder,
        public_id=public_id,
        overwrite=True,
        unique_filename=True,
    )
    return {
        "secure_url": result.get("secure_url"),
        "public_id": result.get("public_id"),
    }