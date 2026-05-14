from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import create_user, get_chat_history, save_message
from goals import (
    add_goal,
    delete_goal,
    get_goals,
    get_goals_summary,
    get_mood_history,
    get_mood_stats,
    log_mood,
    update_goal_progress,
)
from llm import get_ai_response
from memory import get_memory_context, save_to_memory
from sentiment import detect_emotion, get_emotion_instruction, get_emotion_emoji

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserRequest(BaseModel):
    name: str
    email: str


class ChatRequest(BaseModel):
    user_id: str
    message: str


class GoalRequest(BaseModel):
    user_id: str
    title: str
    description: Optional[str] = ""


class ProgressRequest(BaseModel):
    progress: int
    status: Optional[str] = None


@app.get("/")
def root():
    return {"status": "MentorBot running!"}


@app.post("/user/create")
def create_new_user(req: UserRequest):
    user_id = create_user(req.name, req.email)
    return {"user_id": user_id}


@app.post("/chat")
async def chat(req: ChatRequest):
    emotion = detect_emotion(req.message)
    emotion_instr = get_emotion_instruction(req.message)
    emoji = get_emotion_emoji(emotion)
    memory_context = get_memory_context(req.user_id, req.message)
    goals_context = get_goals_summary(req.user_id)

    reply = get_ai_response(
        user_id=req.user_id,
        user_message=req.message,
        memory_context=memory_context,
        emotion_instruction=emotion_instr,
        goals_context=goals_context,
    )

    save_message(req.user_id, "user", req.message)
    save_message(req.user_id, "assistant", reply)
    save_to_memory(req.user_id, req.message, reply)
    log_mood(req.user_id, emotion)

    return {"reply": reply, "emotion": emotion, "emotion_emoji": emoji}


@app.get("/history/{user_id}")
def history(user_id: str):
    return {"history": get_chat_history(user_id)}


@app.post("/goals/add")
def add_new_goal(req: GoalRequest):
    goal = add_goal(req.user_id, req.title, req.description)
    return {"goal": goal}


@app.get("/goals/{user_id}")
def fetch_goals(user_id: str):
    return {"goals": get_goals(user_id)}


@app.put("/goals/{goal_id}/progress")
def update_progress(goal_id: str, req: ProgressRequest):
    update_goal_progress(goal_id, req.progress, req.status)
    return {"message": "Updated"}


@app.delete("/goals/{goal_id}")
def remove_goal(goal_id: str):
    delete_goal(goal_id)
    return {"message": "Deleted"}


@app.get("/analytics/{user_id}")
def analytics(user_id: str):
    history = get_chat_history(user_id, limit=200)
    goals = get_goals(user_id)
    mood_stats = get_mood_stats(user_id)
    mood_hist = get_mood_history(user_id)

    total_msgs = len(history)
    user_msgs = len([m for m in history if m["role"] == "user"])
    total_goals = len(goals)
    active_goals = len([g for g in goals if g["status"] == "active"])
    done_goals = len([g for g in goals if g["status"] == "completed"])
    avg_progress = int(sum(g["progress"] for g in goals) / total_goals) if total_goals else 0

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