import re
from pathlib import Path

# Very small sanitizer: keep letters, digits, dots, dashes, underscores
def secure_filename(name: str) -> str:
    name = Path(name).name  # drop any directories
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name[:200] or "file"
