from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class StudentProfile(BaseModel):
    year: int
    branch: str
    current_skills: List[str]
    interests: List[str]
    target_goal: str
    timeline: str

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    session_id: Optional[str] = None # Used to link messages to a specific chat
    message: str
    history: List[ChatMessage] = []
    profile: StudentProfile

class ChatResponse(BaseModel):
    message: str
    session_id: str # Returns the ID so the frontend can remember it

# Blueprint for the sidebar items
class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class SessionRename(BaseModel):
    title: str