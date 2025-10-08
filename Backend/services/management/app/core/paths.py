from pathlib import Path

# ---------------------------------------------------------
# Hardcoded storage root for now
# ---------------------------------------------------------

def storage_root() -> Path:
    """
    Always points to <project_root>/Backend/data/uploads
    regardless of where uvicorn is launched from.
    """
    # resolve current file → go up until we find the "Backend" folder
    here = Path(__file__).resolve()
    backend_root = next(
        (p for p in here.parents if p.name == "Backend"), here.parents[3]
    )

    # build path Backend/data/uploads
    root = (backend_root / "data" / "uploads").resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def bucket_name() -> str:
    """Return a static bucket name used for saving files."""
    return "smartchange-docs"
