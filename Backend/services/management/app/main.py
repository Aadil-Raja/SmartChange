from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.deps.db import init_db
from app.routers import health, users, auth

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ✅ Runs at startup
    init_db()
    yield
    # ✅ Runs at shutdown (optional cleanup, nothing for now)

app = FastAPI(
    title="SmartChange Management API",
    lifespan=lifespan
)

# Register routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])

@app.get("/")
def root():
    return {"message": "SmartChange API running"}
