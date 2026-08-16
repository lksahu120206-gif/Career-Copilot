"""API routers for sessions management and chatting."""
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import db_models
from app.agent.bot import generate_mentor_response
from app.auth.clerk import get_current_user
from database import get_db

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class ChatMessageIn(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    history: List[ChatMessageIn] = Field(default_factory=list)


class ChatResponse(BaseModel):
    message: str
    session_id: str


class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: str


class MessageOut(BaseModel):
    role: str
    text: str


class SessionDetail(BaseModel):
    id: str
    title: str
    created_at: str
    messages: List[MessageOut]


class SessionRename(BaseModel):
    title: str


def _serialize_session(session: db_models.ChatSession) -> SessionSummary:
    return SessionSummary(
        id=session.id,
        title=session.title,
        created_at=session.created_at.isoformat(),
    )


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------
@router.get("/sessions", response_model=List[SessionSummary])
def get_sessions(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    sessions = (
        db.query(db_models.ChatSession)
        .order_by(db_models.ChatSession.created_at.desc())
        .all()
    )
    return [_serialize_session(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    session = (
        db.query(db_models.ChatSession)
        .filter(db_models.ChatSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetail(
        id=session.id,
        title=session.title,
        created_at=session.created_at.isoformat(),
        messages=[
            MessageOut(role=m.role, text=m.text) for m in session.messages
        ],
    )


@router.post("/sessions", response_model=SessionSummary)
def create_session(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    session = db_models.ChatSession(id=str(uuid.uuid4()))
    db.add(session)
    db.commit()
    db.refresh(session)
    return _serialize_session(session)


@router.put("/sessions/{session_id}", response_model=SessionSummary)
def rename_session(
    session_id: str,
    payload: SessionRename,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    session = (
        db.query(db_models.ChatSession)
        .filter(db_models.ChatSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = payload.title
    db.commit()
    db.refresh(session)
    return _serialize_session(session)


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    session = (
        db.query(db_models.ChatSession)
        .filter(db_models.ChatSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"deleted": session_id}


# ---------------------------------------------------------------------------
# Chat endpoint
# ---------------------------------------------------------------------------
@router.post("/chat", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    # 1. Resolve or create the session
    session_id = request.session_id or str(uuid.uuid4())
    session = (
        db.query(db_models.ChatSession)
        .filter(db_models.ChatSession.id == session_id)
        .first()
    )
    if not session:
        session = db_models.ChatSession(id=session_id)
        db.add(session)
        db.flush()

    # 2. Save the user's message
    db.add(
        db_models.ChatMessage(
            session_id=session.id,
            role="user",
            text=request.message,
        )
    )
    db.commit()

    # 3. Generate the AI response
    try:
        ai_text = generate_mentor_response(request.message, session.id)
    except Exception as exc:  # pragma: no cover - agent failure fallback
        ai_text = (
            "I hit a temporary issue generating a response. Please check "
            f"that GEMINI_API_KEY is set and try again. ({exc})"
        )

    # 4. Save the AI response
    db.add(
        db_models.ChatMessage(
            session_id=session.id,
            role="assistant",
            text=ai_text,
        )
    )
    # Auto-title the session from the first user message
    if session.title in ("New Conversation", None):
        session.title = " ".join(request.message.split())[:60] or "New Conversation"
    db.commit()

    return ChatResponse(message=ai_text, session_id=session.id)
