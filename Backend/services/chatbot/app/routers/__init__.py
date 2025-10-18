# APP-API SERVICE: API routers for the app-api service
# This file imports all routers for the app-api service

from . import health
from . import chat
from . import chat_manage
__all__ = [ "health","chat", "chat_manage"]