# APP-API SERVICE: Health check endpoints
# This file contains health check and monitoring endpoints

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import sys
import os

# Add shared modules to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'shared'))

from ..deps.db import get_db

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "app-api"
    }

@router.get("/health/db")
async def database_health_check(db: Session = Depends(get_db)):
    """Database health check endpoint"""
    try:
        # Simple query to check database connectivity
        result = db.execute("SELECT 1").scalar()
        return {
            "status": "healthy",
            "database": "connected",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.get("/health/detailed")
async def detailed_health_check(db: Session = Depends(get_db)):
    """Detailed health check with system information"""
    try:
        # Check database
        db_result = db.execute("SELECT 1").scalar()
        db_status = "connected" if db_result else "disconnected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "app-api",
        "version": "1.0.0",
        "database": db_status,
        "environment": "development"  # This could come from settings
    }