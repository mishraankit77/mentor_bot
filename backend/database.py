from pymongo import MongoClient, ASCENDING, DESCENDING
from datetime import datetime
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

_client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/mentorbot"))
db = _client["mentorbot"]

def ensure_indexes():
    db.messages.create_index([("user_id", ASCENDING), ("session_id", ASCENDING), ("timestamp", ASCENDING)])
    db.memories.create_index([("user_id", ASCENDING)], unique=True)
    db.goals.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
    db.mood_logs.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])

def create_user(name: str, email: str) -> str:
    existing = db.users.find_one({"email": email})
    if existing:
        return str(existing["_id"])

    result = db.users.insert_one({
        "name": name,
        "email": email,
        "created_at": datetime.utcnow()
    })
    return str(result.inserted_id)

def get_user(user_id: str) -> dict | None:
    doc = db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        return None

    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "email": doc["email"]
    }

def save_message(user_id: str, session_id: str, role: str, content: str):
    db.messages.insert_one({
        "user_id": user_id,
        "session_id": session_id,
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow()
    })

def get_chat_history(user_id: str, limit: int = 200, session_id: str = None) -> list:
    query = {"user_id": user_id}
    if session_id:
        query["session_id"] = session_id

    msgs = db.messages.find(
        query,
        {"_id": 0, "session_id": 1, "role": 1, "content": 1, "timestamp": 1}
    ).sort("timestamp", ASCENDING).limit(limit)

    return [_fmt_message(m) for m in msgs]

def get_recent_messages(user_id: str, limit: int = 10, session_id: str = None) -> list:
    query = {"user_id": user_id}
    if session_id:
        query["session_id"] = session_id

    msgs = db.messages.find(
        query,
        {"_id": 0, "session_id": 1, "role": 1, "content": 1, "timestamp": 1}
    ).sort("timestamp", DESCENDING).limit(limit)

    result = [_fmt_message(m) for m in msgs]
    result.reverse()
    return result

def count_messages(user_id: str, session_id: str = None) -> int:
    query = {"user_id": user_id}
    if session_id:
        query["session_id"] = session_id
    return db.messages.count_documents(query)

def _fmt_message(doc: dict) -> dict:
    ts = doc.get("timestamp")
    return {
        "session_id": doc.get("session_id", "legacy-session"),
        "role": doc["role"],
        "content": doc["content"],
        "timestamp": ts.isoformat() if isinstance(ts, datetime) else str(ts)
    }

def save_summary(user_id: str, summary_text: str):
    db.memories.update_one(
        {"user_id": user_id},
        {"$set": {
            "summary": summary_text,
            "updated_at": datetime.utcnow()
        }},
        upsert=True
    )

def get_summary(user_id: str) -> str:
    doc = db.memories.find_one({"user_id": user_id})
    return doc["summary"] if doc else ""

def add_goal(user_id: str, title: str, description: str = "") -> dict:
    now = datetime.utcnow()
    result = db.goals.insert_one({
        "user_id": user_id,
        "title": title,
        "description": description,
        "status": "active",
        "progress": 0,
        "created_at": now,
        "updated_at": now
    })

    return _fmt_goal({
        "_id": result.inserted_id,
        "title": title,
        "description": description,
        "status": "active",
        "progress": 0,
        "created_at": now
    })

def get_goals(user_id: str) -> list:
    docs = db.goals.find({"user_id": user_id}).sort("created_at", DESCENDING)
    return [_fmt_goal(d) for d in docs]

def update_goal_progress(goal_id: str, progress: int, status: str = None):
    status = status or ("completed" if progress >= 100 else "active")
    db.goals.update_one(
        {"_id": ObjectId(goal_id)},
        {"$set": {
            "progress": progress,
            "status": status,
            "updated_at": datetime.utcnow()
        }}
    )

def delete_goal(goal_id: str):
    db.goals.delete_one({"_id": ObjectId(goal_id)})

def get_goals_summary_text(user_id: str) -> str:
    goals = get_goals(user_id)
    if not goals:
        return ""

    active = [g for g in goals if g["status"] == "active"]
    done = [g for g in goals if g["status"] == "completed"]

    lines = ["[USER GOALS]"]
    for g in active:
        lines.append(f"  - {g['title']} ({g['progress']}% done)")
    if done:
        lines.append(f"  Completed: {', '.join(g['title'] for g in done)}")
    lines.append("Gently reference these goals when relevant. [END GOALS]")
    return "\n".join(lines)

def _fmt_goal(doc) -> dict:
    ts = doc.get("created_at", datetime.utcnow())
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "description": doc.get("description", ""),
        "status": doc["status"],
        "progress": doc["progress"],
        "created_at": ts.isoformat() if isinstance(ts, datetime) else str(ts),
    }

def log_mood(user_id: str, emotion: str):
    db.mood_logs.insert_one({
        "user_id": user_id,
        "emotion": emotion,
        "created_at": datetime.utcnow()
    })

def get_mood_history(user_id: str, limit: int = 20) -> list:
    docs = db.mood_logs.find(
        {"user_id": user_id},
        {"_id": 0, "emotion": 1, "created_at": 1}
    ).sort("created_at", DESCENDING).limit(limit)

    return [
        {"emotion": d["emotion"], "date": d["created_at"].isoformat()}
        for d in docs
    ]

def get_mood_stats(user_id: str) -> dict:
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": DESCENDING}}
    ]
    return {doc["_id"]: doc["count"] for doc in db.mood_logs.aggregate(pipeline)}
