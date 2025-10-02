from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.deps.db import init_db
from app.routers import health, users, auth
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:8000", "http://127.0.0.1:8000", "file://"],  # add your test origin(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Register routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])

@app.get("/")
def root():
    return {"message": "SmartChange API running"}
