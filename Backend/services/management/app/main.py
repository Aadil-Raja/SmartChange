from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.deps.db import init_db, SessionLocal
from app import routers
from app.core.seeder import seed_superadmin  # <-- call your seeder here



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
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # Alternative Vite port
        "http://127.0.0.1:5174",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
         "http://82.112.254.202:3010",
        "file://",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],  # ADD THIS LINE
)
# Routers
app.include_router(routers.health.router, prefix="/health", tags=["health"])

app.include_router(routers.auth.router,   prefix="/auth",   tags=["auth"])
app.include_router(routers.admin.router, prefix="/admin", tags=["admin"])
app.include_router(routers.employee.router, prefix="/employee", tags=["employee "])
app.include_router(routers.announcements.router, prefix="/teams", tags=["announcements"])
app.include_router(routers.admin_training.router, prefix="/admin-training", tags=["Admin - Training"])
app.include_router(routers.quiz.router, prefix="/api", tags=["quizzes"])
@app.get("/")
def root():
    return {"message": "SmartChange API running"}
