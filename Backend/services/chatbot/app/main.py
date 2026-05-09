from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from app.deps import init_db
from app import routers
from app.middleware.timing import DetailedTimingMiddleware




@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()

    # Pre-warm reranker models in background so first request isn't slow
    import threading
    def _prewarm():
        try:
            from app.services.tools.hybrid_retrieval import _get_reranker_model
            from app.core.config import get_settings
            s = get_settings()
            print("[STARTUP] Pre-warming fast reranker...", flush=True)
            _get_reranker_model(s.reranker_model_fast)
            print("[STARTUP] Pre-warming deep reranker...", flush=True)
            _get_reranker_model(s.reranker_model_deep)
            print("[STARTUP] Both reranker models ready.", flush=True)
        except Exception as e:
            print(f"[STARTUP] Reranker pre-warm failed: {e}", flush=True)
    threading.Thread(target=_prewarm, daemon=True).start()

    yield
    # Shutdown (nothing to clean up for now)

app = FastAPI(
    title="Chatbot Management API",
    lifespan=lifespan,
)

# Add timing middleware BEFORE CORS (so it measures total time including CORS)
app.add_middleware(DetailedTimingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
            "http://localhost:5173",
    "http://127.0.0.1:5173",
     "http://82.112.254.202:3010",
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
app.include_router(routers.chathead_settings.router, prefix="/chat/chatheads", tags=["chathead_settings"])
from app.routers import internal
app.include_router(internal.router, prefix="/internal", tags=["internal"])
@app.get("/")
def root():
    return {"message": "Chatbot API running"}
