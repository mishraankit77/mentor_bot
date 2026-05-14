from datetime import datetime, timedelta
from typing import Optional

from bson import ObjectId
from bson.errors import InvalidId

from database import db


def _goal_to_dict(doc) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "description": doc.get("description", ""),
        "status": doc.get("status", "active"),
        "progress": int(doc.get("progress", 0)),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        "updated_at": doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    }


def add_goal(user_id: str, title: str, description: str = "") -> dict:
    now = datetime.utcnow()
    result = db.goals.insert_one(
        {
            "user_id": user_id,
            "title": title.strip(),
            "description": description.strip(),
            "status": "active",
            "progress": 0,
            "created_at": now,
            "updated_at": now,
        }
    )
    doc = db.goals.find_one({"_id": result.inserted_id})
    return _goal_to_dict(doc)


def get_goals(user_id: str) -> list:
    rows = (
        db.goals.find({"user_id": user_id})
        .sort("created_at", -1)
    )
    return [_goal_to_dict(row) for row in rows]


def update_goal_progress(goal_id: str, progress: int, status: Optional[str] = None) -> bool:
    try:
        oid = ObjectId(goal_id)
    except InvalidId:
        return False

    progress = max(0, min(100, int(progress)))
    now = datetime.utcnow()
    final_status = status if status else ("completed" if progress >= 100 else "active")

    result = db.goals.update_one(
        {"_id": oid},
        {
            "$set": {
                "progress": progress,
                "status": final_status,
                "updated_at": now,
            }
        },
    )
    return result.modified_count > 0


def delete_goal(goal_id: str) -> bool:
    try:
        oid = ObjectId(goal_id)
    except InvalidId:
        return False

    result = db.goals.delete_one({"_id": oid})
    return result.deleted_count > 0


def get_goals_summary(user_id: str) -> str:
    goals = get_goals(user_id)
    if not goals:
        return ""

    active = [g for g in goals if g["status"] == "active"]
    done = [g for g in goals if g["status"] == "completed"]

    lines = ["[USER'S GOALS]"]
    for g in active:
        lines.append(f"- {g['title']} (Progress: {g['progress']}%)")

    if done:
        lines.append("Completed goals: " + ", ".join(g["title"] for g in done))

    lines.append("Gently check on their progress if relevant.")
    lines.append("[END GOALS]")
    return "\n".join(lines)


def log_mood(user_id: str, emotion: str):
    db.mood_logs.insert_one(
        {
            "user_id": user_id,
            "emotion": emotion,
            "created_at": datetime.utcnow(),
        }
    )


def get_mood_history(user_id: str, days: int = 7) -> list:
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.mood_logs.find(
            {"user_id": user_id, "created_at": {"$gte": cutoff}},
            {"_id": 0, "emotion": 1, "created_at": 1},
        )
        .sort("created_at", -1)
    )
    return [
        {
            "emotion": row["emotion"],
            "date": row["created_at"].isoformat() if row.get("created_at") else None,
        }
        for row in rows
    ]


def get_mood_stats(user_id: str) -> dict:
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = db.mood_logs.aggregate(pipeline)
    return {row["_id"]: row["count"] for row in rows}