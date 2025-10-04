from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.deps.db import init_db, SessionLocal
from app.routers import health, users, auth
from app.core.seeder import seed_superadmin  # <-- call your seeder here
from app.routers import admin
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()

    # Run seeders (short-lived session)
    db = SessionLocal()
    try:
        seed_superadmin(db)
    finally:
        db.close()

    yield
    # Shutdown (nothing to clean up for now)

app = FastAPI(
    title="SmartChange Management API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "file://",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(users.router,  prefix="/users",  tags=["users"])
app.include_router(auth.router,   prefix="/auth",   tags=["auth"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
@app.get("/")
def root():
    return {"message": "SmartChange API running"}
