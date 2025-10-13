from pathlib import Path
from app.utils.filename_utils import secure_filename
from app.core.paths import storage_root, bucket_name


def save_bytes(bytes_data: bytes, *, user_id: int, original_name: str) -> str:
    """
    Save a file to local storage in a clean, config-driven path.

    Final structure:
      <storage_root>/<bucket_name>/raw/<user_id>/<safe_filename>

    Example:
      Backend/data/uploads/smartchange-docs/raw/12/manual.pdf

    Returns:
      The absolute file path as a string.
    """
    # clean file name
    filename = secure_filename(original_name)

    # build the base directory path dynamically from config
    base: Path = storage_root() / bucket_name() / "raw" / str(user_id)
    base.mkdir(parents=True, exist_ok=True)

    # write file bytes
    dest: Path = base / filename
    dest.write_bytes(bytes_data)

    # return full absolute path
    return str(dest.resolve())
