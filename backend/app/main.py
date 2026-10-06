from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.conversations import router as conversations_router
from app.api.messages import router as messages_router
from app.api.playground import router as playground_router
from app.core.config import settings
from app.db.database import init_db
from app.ollama.client import OllamaClient, OllamaUnavailable


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.ollama = OllamaClient(settings.ollama_base_url, settings.request_timeout_seconds)
    yield
    await app.state.ollama.close()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(conversations_router)
app.include_router(messages_router)
app.include_router(chat_router)
app.include_router(playground_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/ollama/status")
async def ollama_status(request: Request):
    try:
        return await request.app.state.ollama.status()
    except OllamaUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/ollama/models")
async def ollama_models(request: Request):
    try:
        return {"models": await request.app.state.ollama.list_models()}
    except OllamaUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
