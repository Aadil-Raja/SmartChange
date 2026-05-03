from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool, AsyncAdaptedQueuePool
from app.models import Base
from app.core.config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# ============================================================================
# ASYNC DATABASE CONFIGURATION (For 10-20K concurrent users)
# ============================================================================

# Convert postgresql:// to postgresql+asyncpg:// for async support
def get_async_url(sync_url: str) -> str:
    """Convert sync database URL to async URL"""
    if sync_url.startswith("postgresql://"):
        return sync_url.replace("postgresql://", "postgresql+asyncpg://")
    return sync_url

# Async engine configuration for high concurrency
ASYNC_POOL_CONFIG = {
    "poolclass": AsyncAdaptedQueuePool,
    "pool_size": 30,              # 30 persistent connections
    "max_overflow": 70,           # Allow 70 more during spikes (total: 100)
    "pool_timeout": 30,           # Wait 30s for connection
    "pool_recycle": 1800,         # Recycle every 30 minutes
    "pool_pre_ping": True,        # Test connection health before using
    "echo": False,                # Set to True for SQL debugging
    "connect_args": {
        "server_settings": {
            "application_name": "smartchange_chatbot_async",
            "jit": "off",  # Disable JIT for faster simple queries
        },
        "command_timeout": 60,  # Query timeout: 60 seconds
        "timeout": 10,          # Connection timeout: 10 seconds
    }
}

# Create async engines
async_engine = create_async_engine(
    get_async_url(settings.chatbot_database_url),
    **ASYNC_POOL_CONFIG
)

async_management_engine = create_async_engine(
    get_async_url(settings.management_database_url),
    **ASYNC_POOL_CONFIG
)

# Async session factories
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Don't expire objects after commit
    autoflush=False,
    autocommit=False
)

AsyncManagementSessionLocal = async_sessionmaker(
    async_management_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

# ============================================================================
# SYNC DATABASE CONFIGURATION (For backward compatibility)
# ============================================================================

# Sync engine configuration (for non-async code)
SYNC_POOL_CONFIG = {
    "poolclass": QueuePool,
    "pool_size": 20,
    "max_overflow": 30,
    "pool_timeout": 30,
    "pool_recycle": 1800,
    "pool_pre_ping": True,
    "echo_pool": False,
    "connect_args": {
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
        "application_name": "smartchange_chatbot_sync",
    }
}

# Sync engines (for backward compatibility)
engine = create_engine(
    settings.chatbot_database_url,
    future=True,
    **SYNC_POOL_CONFIG
)

management_engine = create_engine(
    settings.management_database_url,
    future=True,
    **SYNC_POOL_CONFIG
)

# Sync session factories
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
ManagementSessionLocal = sessionmaker(bind=management_engine, autoflush=False, autocommit=False)

# ============================================================================
# CONNECTION POOL MONITORING
# ============================================================================

@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    """Log when new sync connection is created"""
    logger.debug("New sync chatbot DB connection created")

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_conn, connection_record, connection_proxy):
    """Log when sync connection is checked out from pool"""
    logger.debug("Sync connection checked out from chatbot pool")

# ============================================================================
# ASYNC DEPENDENCIES (Primary - Use these for new code)
# ============================================================================

async def get_async_db():
    """
    Async dependency for FastAPI routes - Chatbot database
    
    Use this for all new endpoints to support high concurrency.
    
    Example:
        @router.post("/respond-v2")
        async def respond(db: AsyncSession = Depends(get_async_db)):
            # Your async code here
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def get_async_management_db():
    """
    Async dependency for management database
    
    Use this for all new endpoints accessing documents, chunks, sections.
    """
    async with AsyncManagementSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ============================================================================
# SYNC DEPENDENCIES (Backward compatibility - Migrate away from these)
# ============================================================================

def get_db():
    """
    DEPRECATED: Sync dependency for FastAPI routes - Chatbot database
    
    Use get_async_db() instead for better performance with high concurrency.
    This is kept for backward compatibility only.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def get_management_db():
    """
    DEPRECATED: Sync dependency for management database
    
    Use get_async_management_db() instead for better performance.
    This is kept for backward compatibility only.
    """
    db = ManagementSessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

def init_db():
    """Creates all tables in chatbot DB (sync operation)"""
    Base.metadata.create_all(bind=engine)

async def init_db_async():
    """Creates all tables in chatbot DB (async operation)"""
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ============================================================================
# POOL MONITORING (For observability)
# ============================================================================

def get_pool_status():
    """
    Get current connection pool status for monitoring
    
    Returns:
        dict: Pool statistics for both sync and async databases
    """
    return {
        "sync": {
            "chatbot_db": {
                "pool_size": engine.pool.size(),
                "checked_out": engine.pool.checkedout(),
                "overflow": engine.pool.overflow(),
                "total_connections": engine.pool.size() + engine.pool.overflow(),
            },
            "management_db": {
                "pool_size": management_engine.pool.size(),
                "checked_out": management_engine.pool.checkedout(),
                "overflow": management_engine.pool.overflow(),
                "total_connections": management_engine.pool.size() + management_engine.pool.overflow(),
            }
        },
        "async": {
            "chatbot_db": {
                "pool_size": async_engine.pool.size(),
                "checked_out": async_engine.pool.checkedout(),
                "overflow": async_engine.pool.overflow(),
                "total_connections": async_engine.pool.size() + async_engine.pool.overflow(),
            },
            "management_db": {
                "pool_size": async_management_engine.pool.size(),
                "checked_out": async_management_engine.pool.checkedout(),
                "overflow": async_management_engine.pool.overflow(),
                "total_connections": async_management_engine.pool.size() + async_management_engine.pool.overflow(),
            }
        }
    }

async def get_pool_status_async():
    """Async version of get_pool_status()"""
    return get_pool_status()

# ============================================================================
# GRACEFUL SHUTDOWN
# ============================================================================

async def close_db_connections():
    """
    Gracefully close all database connections on shutdown
    
    Call this in your FastAPI lifespan or shutdown event.
    """
    logger.info("Closing database connections...")
    await async_engine.dispose()
    await async_management_engine.dispose()
    engine.dispose()
    management_engine.dispose()
    logger.info("Database connections closed")
