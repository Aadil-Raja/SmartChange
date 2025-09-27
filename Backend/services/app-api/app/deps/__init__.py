# APP-API SERVICE: Shared dependencies for the app-api service
# This file imports all dependencies for the app-api service

from .db import get_db, init_db
from .auth import get_current_user, get_current_active_user, get_current_superuser

__all__ = [
    "get_db", "init_db",
    "get_current_user", "get_current_active_user", "get_current_superuser"
]