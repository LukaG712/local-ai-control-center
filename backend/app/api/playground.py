import asyncio

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.ollama.client import OllamaUnavailable

router = APIRouter(prefix="/api/playground", tags=["playground"])


class CompareRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=20_000)
    models: list[str] = Field(min_length=2, max_length=4)

    @field_validator("models")
    @classmethod
    def unique_models(cls, models: list[str]) -> list[str]:
        if len(set(models)) != len(models):
            raise ValueError("Choose each model only once.")
        return models


@router.post("/compare")
async def compare_models(body: CompareRequest, request: Request):
    ollama = request.app.state.ollama
    try:
        installed = {model.get("name") for model in await ollama.list_models()}
    except OllamaUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    missing = [model for model in body.models if model not in installed]
    if missing:
        raise HTTPException(status_code=422, detail=f"Model is not installed: {missing[0]}")

    async def run(model: str) -> dict:
        try:
            result = await ollama.generate(model, body.prompt)
            return {"model": model, **result}
        except OllamaUnavailable as exc:
            return {"model": model, "error": str(exc)}

    results = await asyncio.gather(*(run(model) for model in body.models))
    return {"results": results}
