import json
from collections.abc import AsyncIterator

import httpx


class OllamaUnavailable(Exception):
    """Raised when Ollama cannot be reached or returns an unsuccessful response."""


class OllamaClient:
    def __init__(self, base_url: str, timeout: float = 10.0) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"), timeout=httpx.Timeout(timeout, read=300.0)
        )

    async def close(self) -> None:
        await self._client.aclose()

    async def list_models(self) -> list[dict]:
        try:
            response = await self._client.get("/api/tags")
            response.raise_for_status()
            return response.json().get("models", [])
        except (httpx.HTTPError, ValueError) as exc:
            raise OllamaUnavailable("Could not connect to Ollama.") from exc

    async def status(self) -> dict:
        try:
            response = await self._client.get("/api/version")
            response.raise_for_status()
            version = response.json().get("version")
        except (httpx.HTTPError, ValueError) as exc:
            raise OllamaUnavailable("Could not connect to Ollama.") from exc
        return {"connected": True, "version": version}

    async def chat_stream(self, model: str, messages: list[dict]) -> AsyncIterator[dict]:
        try:
            async with self._client.stream(
                "POST", "/api/chat", json={"model": model, "messages": messages, "stream": True}
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        yield json.loads(line)
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise OllamaUnavailable(
                    "Ollama could not find that model. Check that it is installed and try again."
                ) from exc
            raise OllamaUnavailable("Ollama could not complete the chat request.") from exc
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise OllamaUnavailable("Ollama could not complete the chat request.") from exc

    async def generate(self, model: str, prompt: str) -> dict:
        try:
            response = await self._client.post(
                "/api/generate", json={"model": model, "prompt": prompt, "stream": False}
            )
            response.raise_for_status()
            result = response.json()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                raise OllamaUnavailable(
                    "Ollama could not find that model. Check that it is installed and try again."
                ) from exc
            raise OllamaUnavailable("Ollama could not complete this model response.") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise OllamaUnavailable("Ollama could not complete this model response.") from exc
        return {
            "response": result.get("response", ""),
            "total_duration": result.get("total_duration"),
            "prompt_eval_duration": result.get("prompt_eval_duration"),
            "eval_count": result.get("eval_count"),
            "eval_duration": result.get("eval_duration"),
        }
