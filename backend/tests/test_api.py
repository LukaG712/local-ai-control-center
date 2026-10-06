from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ollama.client import OllamaUnavailable


@pytest.fixture
def client(tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "database_url", f"sqlite:///{tmp_path / 'test.db'}")
    with TestClient(app) as test_client:
        app.state.ollama = AsyncMock()
        yield test_client


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ollama_status(client):
    app.state.ollama.status.return_value = {"connected": True}
    response = client.get("/api/ollama/status")
    assert response.status_code == 200
    assert response.json() == {"connected": True}


def test_models_list(client):
    app.state.ollama.list_models.return_value = [{"name": "qwen2.5:7b"}]
    response = client.get("/api/ollama/models")
    assert response.status_code == 200
    assert response.json()["models"][0]["name"] == "qwen2.5:7b"


def test_ollama_outage_is_reported_as_service_unavailable(client):
    app.state.ollama.list_models.side_effect = OllamaUnavailable("Could not connect to Ollama.")
    response = client.get("/api/ollama/models")
    assert response.status_code == 503
    assert response.json()["detail"] == "Could not connect to Ollama."


def test_conversation_crud_search_and_messages(client):
    created = client.post(
        "/api/conversations", json={"title": "Scratch pad", "model": "qwen2.5:7b"}
    )
    assert created.status_code == 201
    conversation_id = created.json()["id"]

    message = client.post(
        f"/api/conversations/{conversation_id}/messages", json={"role": "user", "content": "Hello"}
    )
    assert message.status_code == 201
    assert message.json()["content"] == "Hello"

    detail = client.get(f"/api/conversations/{conversation_id}").json()
    assert detail["model"] == "qwen2.5:7b"
    assert [item["role"] for item in detail["messages"]] == ["user"]

    renamed = client.patch(f"/api/conversations/{conversation_id}", json={"title": "Ideas"})
    assert renamed.json()["title"] == "Ideas"
    assert (
        client.get("/api/conversations?search=Ide").json()["conversations"][0]["title"] == "Ideas"
    )

    assert client.delete(f"/api/conversations/{conversation_id}").status_code == 204
    assert client.get(f"/api/conversations/{conversation_id}").status_code == 404


def test_streaming_chat_persists_response_and_ollama_stats(client):

    conversation_id = client.post("/api/conversations", json={"model": "qwen2.5:7b"}).json()["id"]

    async def fake_stream(model, messages):
        assert model == "qwen2.5:7b"
        assert messages[-1] == {"role": "user", "content": "Hi"}
        yield {"message": {"content": "Hello"}, "done": False}
        yield {
            "message": {"content": " there."},
            "done": True,
            "total_duration": 2_000_000_000,
            "prompt_eval_duration": 400_000_000,
            "eval_count": 4,
            "eval_duration": 800_000_000,
        }

    app.state.ollama.chat_stream = fake_stream
    response = client.post(
        "/api/chat/stream",
        json={"conversation_id": conversation_id, "model": "qwen2.5:7b", "message": "Hi"},
    )
    assert response.status_code == 200
    assert '"content": " there."' in response.text
    assert '"eval_count": 4' in response.text

    conversation = client.get(f"/api/conversations/{conversation_id}").json()
    assistant = conversation["messages"][-1]
    assert assistant["content"] == "Hello there."
    assert assistant["eval_count"] == 4
    assert assistant["total_duration_ns"] == 2_000_000_000


def test_playground_compares_models_concurrently_using_mocked_ollama(client):
    import asyncio

    app.state.ollama.list_models.return_value = [{"name": "model-a"}, {"name": "model-b"}]

    async def fake_generate(model, prompt):
        await asyncio.sleep(0)
        return {
            "response": f"{model}: {prompt}",
            "total_duration": 1_000_000_000,
            "prompt_eval_duration": 200_000_000,
            "eval_count": 5,
            "eval_duration": 500_000_000,
        }

    app.state.ollama.generate = fake_generate
    response = client.post(
        "/api/playground/compare",
        json={"prompt": "Explain local-first.", "models": ["model-a", "model-b"]},
    )
    assert response.status_code == 200
    assert [result["response"] for result in response.json()["results"]] == [
        "model-a: Explain local-first.",
        "model-b: Explain local-first.",
    ]
    assert response.json()["results"][0]["eval_count"] == 5


def test_playground_rejects_uninstalled_models(client):
    app.state.ollama.list_models.return_value = [{"name": "model-a"}]
    response = client.post(
        "/api/playground/compare", json={"prompt": "Test", "models": ["model-a", "missing"]}
    )
    assert response.status_code == 422


def test_document_tool_persists_and_answers_with_relevant_local_context(client):
    app.state.ollama.list_models.return_value = [{"name": "model-a"}]

    async def fake_generate(model, prompt):
        assert model == "model-a"
        assert "Local AI Control Center stores conversation history in SQLite." in prompt
        assert "Unrelated note about growing tomatoes." not in prompt
        return {"response": "History is stored in SQLite.", "eval_count": 7, "eval_duration": 1_000_000_000}

    app.state.ollama.generate = fake_generate
    created = client.post(
        "/api/tools/documents",
        json={
            "name": "notes.md",
            "content": "Local AI Control Center stores conversation history in SQLite.\n\nUnrelated note about growing tomatoes.",
        },
    )
    assert created.status_code == 201
    document_id = created.json()["id"]
    assert client.get("/api/tools/documents").json()["documents"][0]["name"] == "notes.md"

    response = client.post(
        "/api/tools/documents/ask",
        json={"model": "model-a", "question": "Where is conversation history stored?"},
    )
    assert response.status_code == 200
    assert response.json()["answer"] == "History is stored in SQLite."
    assert response.json()["sources"] == ["notes.md"]
    assert client.delete(f"/api/tools/documents/{document_id}").status_code == 204


def test_document_tool_rejects_unsupported_file_type(client):
    response = client.post("/api/tools/documents", json={"name": "payload.exe", "content": "text"})
    assert response.status_code == 422


def test_code_explainer_uses_selected_installed_model(client):
    app.state.ollama.list_models.return_value = [{"name": "model-a"}]

    async def fake_generate(model, prompt):
        assert model == "model-a"
        assert "return 1 + 1" in prompt
        return {"response": "It returns two."}

    app.state.ollama.generate = fake_generate
    response = client.post(
        "/api/tools/explain-code",
        json={"model": "model-a", "code": "return 1 + 1", "question": "What does this return?"},
    )
    assert response.status_code == 200
    assert response.json()["explanation"] == "It returns two."
