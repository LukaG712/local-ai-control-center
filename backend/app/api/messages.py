from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.db.database import connect

router = APIRouter(prefix="/api/conversations/{conversation_id}/messages", tags=["messages"])


class MessageCreate(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=100_000)


@router.post("", status_code=201)
def create_message(conversation_id: str, body: MessageCreate):
    timestamp = datetime.now(UTC).isoformat()
    with connect() as db:
        if not db.execute(
            "SELECT 1 FROM conversations WHERE id = ?", (conversation_id,)
        ).fetchone():
            raise HTTPException(status_code=404, detail="Conversation not found.")
        message_id = str(uuid4())
        db.execute(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (message_id, conversation_id, body.role, body.content, timestamp),
        )
        db.execute(
            "UPDATE conversations SET updated_at = ? WHERE id = ?", (timestamp, conversation_id)
        )
        row = db.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
    return dict(row)
