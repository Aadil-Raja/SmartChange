# APP-API SERVICE: Service-specific Pydantic schemas
# This file contains schemas specific to the app-api service

from .auth import LoginRequest, LoginResponse, Token

__all__ = ["LoginRequest", "LoginResponse", "Token"]