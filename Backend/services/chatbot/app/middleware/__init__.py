"""
Middleware package for FastAPI application.
"""
from .timing import DetailedTimingMiddleware

__all__ = ["DetailedTimingMiddleware"]
