"""
main.py  -- FastAPI application
"""

from fastapi import FastAPI, Depends, Request, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from io import BytesIO
from pypdf import PdfReader
import os
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import (
    save_message, get_chat_history,
    ensure_indexes
)
from memory import get_memory_context, maybe_summarize
from llm import get_ai_response, analyze_image
from sentiment import detect_emotion, get_emotion_instruction, get_emotion_emoji
from goals import (
    add_goal, get_goals, update_goal_progress,
    delete_goal, get_goals_summary,
    log_mood, get_mood_history, get_mood_stats
)
from auth import get_current_user, register_user, login_user

load_dotenv()

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="MentorBot API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    ensure_indexes()


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=5, max_length=200)
    password: str = Field(..., min_length=6, max_length=100)

class LoginRequest(BaseModel):
    email: str = Field(..., max_length=200)
    password: str = Field(..., max_length=100)

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: str = Field(..., min_length=1, max_length=120)

class GoalRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field("", max_length=500)

class ProgressRequest(BaseModel):
    progress: int = Field(..., ge=0, le=100)
    status: Optional[str] = None


def extract_text_from_upload(file: UploadFile, data: bytes) -> str:
    filename = (file.filename or "uploaded-file").lower()
    content_type = file.content_type or ""

    if filename.endswith(".pdf") or content_type == "application/pdf":
        try:
            reader = PdfReader(BytesIO(data))
            pages = []

            for i, page in enumerate(reader.pages[:20], start=1):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(f"[Page {i}]\n{text.strip()}")

            return "\n\n".join(pages).strip()
        except Exception:
            return ""

    if (
        filename.endswith(".txt")
        or filename.endswith(".md")
        or filename.endswith(".csv")
        or content_type.startswith("text/")
    ):
        return data.decode("utf-8", errors="ignore").strip()

    if content_type.startswith("image/"):
        try:
            return analyze_image(data, content_type, file.filename or "uploaded image")
        except Exception as e:
            print(f"[Vision] Image analysis failed: {e}")
            return (
                f"Image uploaded: {file.filename}\n"
                "I could not analyze this image automatically. Please describe it or try a smaller image."
            )

    return data.decode("utf-8", errors="ignore").strip()


@app.get("/")
def root():
    return {"status": "MentorBot API running"}

@app.post("/auth/register")
def register(req: RegisterRequest):
    return register_user(req.name, req.email, req.password)

@app.post("/auth/login")
def login(req: LoginRequest):
    return login_user(req.email, req.password)


@app.post("/chat")
@limiter.limit("30/minute")
async def chat(
    request: Request,
    req: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user["id"]

    emotion = detect_emotion(req.message)
    emotion_instr = get_emotion_instruction(emotion)
    emoji = get_emotion_emoji(emotion)

    memory_context = get_memory_context(user_id, req.session_id)
    goals_context = get_goals_summary(user_id)

    reply = get_ai_response(
        user_id=user_id,
        user_message=req.message,
        memory_context=memory_context,
        emotion_instruction=emotion_instr,
        goals_context=goals_context
    )

    save_message(user_id, req.session_id, "user", req.message)
    save_message(user_id, req.session_id, "assistant", reply)

    maybe_summarize(user_id)
    log_mood(user_id, emotion)

    return {
        "reply": reply,
        "emotion": emotion,
        "emotion_emoji": emoji,
        "session_id": req.session_id
    }


@app.get("/history")
def history(current_user: dict = Depends(get_current_user)):
    return {"history": get_chat_history(current_user["id"], limit=200)}


@app.post("/files/extract")
async def extract_file_text(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    data = await file.read()

    max_size = 4 * 1024 * 1024 if (file.content_type or "").startswith("image/") else 8 * 1024 * 1024
    if len(data) > max_size:
        raise HTTPException(
            status_code=413,
            detail="File too large. Images must be under 4MB. Other files must be under 8MB."
        )

    extracted_text = extract_text_from_upload(file, data)

    if not extracted_text:
        raise HTTPException(status_code=400, detail="Could not extract text from this file.")

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "text": extracted_text[:12000],
    }


@app.post("/goals")
def add_new_goal(
    req: GoalRequest,
    current_user: dict = Depends(get_current_user)
):
    goal = add_goal(current_user["id"], req.title, req.description)
    return {"goal": goal}

@app.get("/goals")
def fetch_goals(current_user: dict = Depends(get_current_user)):
    return {"goals": get_goals(current_user["id"])}

@app.put("/goals/{goal_id}/progress")
def update_progress(
    goal_id: str,
    req: ProgressRequest,
    current_user: dict = Depends(get_current_user)
):
    update_goal_progress(goal_id, req.progress, req.status)
    return {"message": "Updated"}

@app.delete("/goals/{goal_id}")
def remove_goal(
    goal_id: str,
    current_user: dict = Depends(get_current_user)
):
    delete_goal(goal_id)
    return {"message": "Deleted"}


@app.get("/analytics")
def analytics(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    hist = get_chat_history(user_id, limit=200)
    goals = get_goals(user_id)
    mood_stats = get_mood_stats(user_id)
    mood_hist = get_mood_history(user_id)

    total_msgs = len(hist)
    user_msgs = sum(1 for m in hist if m["role"] == "user")
    total_goals = len(goals)
    active_goals = sum(1 for g in goals if g["status"] == "active")
    done_goals = sum(1 for g in goals if g["status"] == "completed")
    avg_progress = (
        int(sum(g["progress"] for g in goals) / total_goals)
        if total_goals else 0
    )

    return {
        "total_messages": total_msgs,
        "user_messages": user_msgs,
        "total_goals": total_goals,
        "active_goals": active_goals,
        "completed_goals": done_goals,
        "avg_progress": avg_progress,
        "mood_stats": mood_stats,
        "mood_history": mood_hist[:20],
        "goals": goals,
    }
