from datetime import UTC, datetime
from json import dumps
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.db.database import connect
from app.ollama.client import OllamaUnavailable

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    conversation_id: str
    model: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=1, max_length=100_000)


def timestamp() -> str:
    return datetime.now(UTC).isoformat()


def event(payload: dict) -> str:
    return f"data: {dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def stream_chat(body: ChatRequest, request: Request):
    with connect() as db:
        conversation = db.execute(
            "SELECT id, title FROM conversations WHERE id = ?", (body.conversation_id,)
        ).fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        existing = db.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY rowid",
            (body.conversation_id,),
        ).fetchall()
        current_time = timestamp()
        db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, 'user', ?, ?)",
            (str(uuid4()), body.conversation_id, body.message, current_time),
        )
        title = (
            body.message.strip().splitlines()[0][:72]
            if conversation["title"] == "New conversation"
            else conversation["title"]
        )
        db.execute(
            "UPDATE conversations SET title = ?, model = ?, updated_at = ? WHERE id = ?",
            (title or "New conversation", body.model, current_time, body.conversation_id),
        )
    messages = [{"role": row["role"], "content": row["content"]} for row in existing]
    messages.append({"role": "user", "content": body.message})
    ollama = request.app.state.ollama

    async def generate():
        answer = ""
        stats = {}
        try:
            async for chunk in ollama.chat_stream(body.model, messages):
                message = chunk.get("message", {})
                token = message.get("content", "")
                if token:
                    answer += token
                    yield event({"type": "token", "content": token})
                if chunk.get("done"):
                    stats = {
                        key: chunk.get(key)
                        for key in (
                            "total_duration",
                            "prompt_eval_duration",
                            "eval_count",
                            "eval_duration",
                        )
                    }
                    yield event({"type": "done", **stats})
        except OllamaUnavailable as exc:
            yield event({"type": "error", "message": str(exc)})
        finally:
            if answer:
                completed = timestamp()
                with connect() as db:
                    db.execute(
                        """INSERT INTO messages (id, conversation_id, role, content, created_at,
                        total_duration_ns, prompt_duration_ns, eval_count, eval_duration_ns)
                        VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?)""",
                        (
                            str(uuid4()),
                            body.conversation_id,
                            answer,
                            completed,
                            stats.get("total_duration"),
                            stats.get("prompt_eval_duration"),
                            stats.get("eval_count"),
                            stats.get("eval_duration"),
                        ),
                    )
                    db.execute(
                        "UPDATE conversations SET updated_at = ? WHERE id = ?",
                        (completed, body.conversation_id),
                    )

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
