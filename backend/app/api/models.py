from pydantic import BaseModel
from typing import List, Optional

class StudentProfile(BaseModel):
    year: int
    branch: str
    current_skills: List[str]
    interests: List[str]
    target_goal: str
    timeline: str

class ChatRequest(BaseModel):
    message: str
    profile: StudentProfile

class ChatResponse(BaseModel):
    message: str                             # Main AI text answer 💬
    resources: Optional[List[str]] = None    # Links to curated guides/docs 🔗
    suggested_questions: Optional[List[str]] = None # Follow-up prompt ideas ❓
    generated_document: Optional[str] = None # Exportable markdown/PDF content 📄