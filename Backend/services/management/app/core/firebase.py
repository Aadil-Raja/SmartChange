import firebase_admin
from firebase_admin import credentials

from app.core.config import get_settings
_settings = get_settings()

_inited = False

def ensure_firebase_initialized():
    global _inited
    if _inited:
        return

    if not firebase_admin._apps:
        if not _settings.firebase_credentials_file:
            raise RuntimeError("FIREBASE_CREDENTIALS_FILE not set")
        cred = credentials.Certificate(_settings.firebase_credentials_file)
        firebase_admin.initialize_app(cred)

    _inited = True
