import uuid
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from app.models.schemas import ChatRequest, ChatResponse, SessionSummary, SessionRename
from app.agent.bot import generate_mentor_response
from app.core.database import engine, get_db
from app.models import db_models

# Ensure database tables exist
db_models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy", "message": "Career Copilot backend is running! 🚀"}

@app.get("/api/sessions", response_model=List[SessionSummary])
def get_all_sessions(db: Session = Depends(get_db)):
    sessions = db.query(db_models.ChatSession).order_by(db_models.ChatSession.created_at.desc()).all()
    return sessions

@app.get("/api/sessions/{session_id}")
def get_session_history(session_id: str, db: Session = Depends(get_db)):
    messages = db.query(db_models.ChatMessageDB).filter(db_models.ChatMessageDB.session_id == session_id).order_by(db_models.ChatMessageDB.created_at.asc()).all()
    return {"messages": [{"role": msg.role, "text": msg.text} for msg in messages]}

# --- NEW: Rename a session ---
@app.put("/api/sessions/{session_id}")
def rename_session(session_id: str, request: SessionRename, db: Session = Depends(get_db)):
    session = db.query(db_models.ChatSession).filter(db_models.ChatSession.id == session_id).first()
    if session:
        session.title = request.title # type: ignore
        db.commit()
        return {"message": "Session renamed successfully"}
    return {"error": "Session not found"}

@app.post("/api/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    # 1. Manage the Session ID
    session_id = request.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        title = " ".join(request.message.split()[:5]) + "..."
        new_session = db_models.ChatSession(id=session_id, title=title)
        db.add(new_session)
        db.commit()

    # 2. Save User Message to Database
    user_msg_db = db_models.ChatMessageDB(session_id=session_id, role="user", text=request.message)
    db.add(user_msg_db)
    db.commit()

    # 3. Generate AI Response via LangChain
    ai_text = generate_mentor_response(request.message, request.history, request.profile)

    # 4. Save AI Message to Database
    ai_msg_db = db_models.ChatMessageDB(session_id=session_id, role="ai", text=ai_text)
    db.add(ai_msg_db)
    db.commit()

    return ChatResponse(message=ai_text, session_id=session_id)