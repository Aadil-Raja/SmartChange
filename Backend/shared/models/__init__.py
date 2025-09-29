# SHARED: SQLAlchemy ORM models used across all services
# This file contains the base database models that can be imported by any service

from .user import User, Base
from .email_otp import EmailOTP

__all__ = ["User", "EmailOTP", "Base"]
