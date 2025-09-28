from fastapi import FastAPI
from app.deps.db import init_db
from app.routers import *

app = FastAPI(title="SmartChange Management API")

@app.on_event("startup")
def on_startup():
    init_db()

# Register routers

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(users.router, prefix="/users", tags=["users"])

@app.get("/")
def root():
    return {"message": "SmartChange API running"}
