from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.db.database import connect

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def now() -> str:
    return datetime.now(UTC).isoformat()


class ConversationCreate(BaseModel):
    title: str = Field(default="New conversation", min_length=1, max_length=120)
    model: str | None = None


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=120)


@router.get("")
def list_conversations(search: str | None = Query(default=None, max_length=200)):
    with connect() as db:
        if search:
            rows = db.execute(
                "SELECT * FROM conversations WHERE title LIKE ? ORDER BY updated_at DESC",
                (f"%{search}%",),
            ).fetchall()
        else:
            rows = db.execute("SELECT * FROM conversations ORDER BY updated_at DESC").fetchall()
        return {"conversations": [dict(row) for row in rows]}


@router.post("", status_code=201)
def create_conversation(body: ConversationCreate):
    identifier, timestamp = str(uuid4()), now()
    with connect() as db:
        db.execute(
            "INSERT INTO conversations VALUES (?, ?, ?, ?, ?)",
            (identifier, body.title.strip(), body.model, timestamp, timestamp),
        )
        row = db.execute("SELECT * FROM conversations WHERE id = ?", (identifier,)).fetchone()
    return dict(row)


@router.get("/{conversation_id}")
def get_conversation(conversation_id: str):
    with connect() as db:
        row = db.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        messages = db.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid", (conversation_id,)
        ).fetchall()
    return {**dict(row), "messages": [dict(message) for message in messages]}


@router.patch("/{conversation_id}")
def rename_conversation(conversation_id: str, body: ConversationRename):
    with connect() as db:
        result = db.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (body.title.strip(), now(), conversation_id),
        )
        if not result.rowcount:
            raise HTTPException(status_code=404, detail="Conversation not found.")
        row = db.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,)).fetchone()
    return dict(row)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str):
    with connect() as db:
        result = db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        if not result.rowcount:
            raise HTTPException(status_code=404, detail="Conversation not found.")
