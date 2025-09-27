# SHARED: Global logging configuration used across all services
# This provides consistent logging setup for all services

import logging
import sys
from typing import Optional
from .config import get_settings

def setup_logging(service_name: Optional[str] = None) -> None:
    """Setup global logging configuration for the service"""
    settings = get_settings()
    
    # Create logger
    logger_name = service_name or "app"
    logger = logging.getLogger(logger_name)
    logger.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, settings.log_level.upper()))
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(formatter)
    
    # Add handler to logger
    if not logger.handlers:
        logger.addHandler(console_handler)
    
    # Prevent duplicate logs
    logger.propagate = False
    
    return logger
