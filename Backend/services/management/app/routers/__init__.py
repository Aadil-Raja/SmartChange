# APP-API SERVICE: API routers for the app-api service
# This file imports all routers for the app-api service

from . import health
from . import auth
from . import admin 
from . import employee
from . import announcements
from . import admin_training
from . import quiz
from . import course_quiz
from . import notifications

__all__ = ["health", "auth", "admin", "employee", "announcements", "admin_training", "quiz", "course_quiz", "notifications"]