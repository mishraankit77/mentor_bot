from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017/mentorbot"))
db = client["mentorbot"]

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

def save_message(user_id: str, role: str, content: str):
    db.messages.insert_one({
        "user_id": user_id,
        "role": role,
        "content": content,
        "timestamp": datetime.utcnow()
    })

def get_chat_history(user_id: str, limit: int = 30) -> list:
    msgs = db.messages.find(
        {"user_id": user_id},
        {"_id": 0, "role": 1, "content": 1}
    ).sort("timestamp", 1).limit(limit)
    return list(msgs)

def get_recent_for_prompt(user_id: str, limit: int = 6) -> list:
    msgs = db.messages.find(
        {"user_id": user_id},
        {"_id": 0, "role": 1, "content": 1}
    ).sort("timestamp", -1).limit(limit)
    result = list(msgs)
    result.reverse()
    return result
