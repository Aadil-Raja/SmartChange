# APP-API SERVICE: Main FastAPI application entrypoint
# This is the main application file for the app-api service

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sys
import os

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'shared'))

from shared.core.config import get_settings
from shared.core.logging import setup_logging
from .routers import users, auth, content, health
from .deps.db import init_db

settings = get_settings()
logger = setup_logging("app-api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting app-api service...")
    await init_db()
    logger.info("Database initialized")
    yield
    # Shutdown
    logger.info("Shutting down app-api service...")

app = FastAPI(
    title=settings.project_name,
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=f"{settings.api_v1_prefix}/auth", tags=["authentication"])
app.include_router(users.router, prefix=f"{settings.api_v1_prefix}/users", tags=["users"])
app.include_router(content.router, prefix=f"{settings.api_v1_prefix}/content", tags=["content"])

@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "SmartChange App API", "version": "1.0.0"}