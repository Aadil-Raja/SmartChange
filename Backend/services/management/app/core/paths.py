from pathlib import Path
from app.core.config import get_settings

def storage_root() -> Path:
    """
    Resolves the absolute path to the storage root.
    """
    settings = get_settings()
    env_path = Path(settings.storage_local_root).expanduser()

    # find the actual "Backend" folder in current path tree
    here = Path(__file__).resolve()
    backend_root = next(
        (p for p in here.parents if p.name == "Backend"),
        here.parents[3]
    )

    # if the env path starts with "Backend", drop that segment to avoid Backend/Backend duplication
    parts = env_path.parts
    if parts and parts[0].lower() == "backend":
        rel = Path(*parts[1:])
    else:
        rel = env_path

    # anchor relative path inside the real Backend directory
    root = (backend_root / rel).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def bucket_name() -> str:
    """Return the storage bucket/folder name from .env."""
    return get_settings().storage_bucket


def storage_backend() -> str:
    """Return the active storage backend (local, s3, etc.) from .env."""
    return get_settings().storage_backend
