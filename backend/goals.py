"""
goals.py  ── Goal and mood helpers (now MongoDB-backed)
========================================================
WHY THIS FILE CHANGED:
  Before: goals.py had its own SQLite connection (goals.db),
          its own table creation, its own integer IDs.
          Completely separate from the rest of the data.

  After:  goals.py is now a thin wrapper that delegates
          everything to database.py, which uses MongoDB.
          No more SQLite. No more goals.db file.
          Goal IDs are now MongoDB ObjectId strings.

  The public function names are UNCHANGED so main.py needs
  minimal edits.
"""

from database import (
    add_goal        as _add_goal,
    get_goals       as _get_goals,
    update_goal_progress as _update_progress,
    delete_goal     as _delete_goal,
    get_goals_summary_text,
    log_mood        as _log_mood,
    get_mood_history as _get_mood_history,
    get_mood_stats   as _get_mood_stats,
)

# Re-export with same names main.py already uses
def add_goal(user_id: str, title: str, description: str = "") -> dict:
    return _add_goal(user_id, title, description)

def get_goals(user_id: str) -> list:
    return _get_goals(user_id)

def update_goal_progress(goal_id: str, progress: int, status: str = None):
    _update_progress(goal_id, progress, status)

def delete_goal(goal_id: str):
    _delete_goal(goal_id)

def get_goals_summary(user_id: str) -> str:
    return get_goals_summary_text(user_id)

def log_mood(user_id: str, emotion: str):
    _log_mood(user_id, emotion)

def get_mood_history(user_id: str, limit: int = 20) -> list:
    return _get_mood_history(user_id, limit)

def get_mood_stats(user_id: str) -> dict:
    return _get_mood_stats(user_id)