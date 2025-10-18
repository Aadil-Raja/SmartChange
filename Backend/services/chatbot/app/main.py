from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.deps import init_db
from app import routers




@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()



    yield
    # Shutdown (nothing to clean up for now)

app = FastAPI(
    title="Chatbot Management API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
            "http://localhost:5173",
    "http://127.0.0.1:5173",
        "file://",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(routers.health.router, prefix="/health", tags=["health"])
app.include_router(routers.chat.router, prefix="/chat", tags=["chat"])
app.include_router(routers.chat_manage.router, prefix="/chat/manage", tags=["chat_manage"])
@app.get("/")
def root():
    return {"message": "Chatbot API running"}
