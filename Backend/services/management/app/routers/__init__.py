# APP-API SERVICE: API routers for the app-api service
# This file imports all routers for the app-api service

from . import health
from . import auth
from . import admin 
from . import employee
from . import announcements
__all__ = [ "health","auth", "admin", "employee","announcements" ]