import re
from datetime import datetime

from database import db

TOKEN_RE = re.compile(r"[a-zA-Z0-9']+")

FACT_RULES = {
    "name": [
        r"\bmy name is ([a-zA-Z][a-zA-Z\s'-]{1,60})\b",
        r"\bcall me ([a-zA-Z][a-zA-Z\s'-]{1,60})\b",
    ],
    "study": [
        r"\bi(?:'m| am) preparing for ([^.!,;]+)",
        r"\bi(?:'m| am) studying ([^.!,;]+)",
        r"\bi am doing ([^.!,;]+) study",
    ],
    "goal": [
        r"\bmy goal is ([^.!,;]+)",
        r"\bi want to ([^.!,;]+)",
        r"\bi need to ([^.!,;]+)",
    ],
    "work": [
        r"\bi(?:'m| am) working as ([^.!,;]+)",
        r"\bi(?:'m| am) a[n]? ([^.!,;]+)",
    ],
    "location": [
        r"\bi(?:'m| am) from ([^.!,;]+)",
        r"\bi live in ([^.!,;]+)",
    ],
    "preference": [
        r"\bi like ([^.!,;]+)",
        r"\bi love ([^.!,;]+)",
        r"\bi prefer ([^.!,;]+)",
    ],
}


def _clean_value(value: str) -> str:
    value = value.strip().strip(".!?,;: ")
    value = re.split(r"\b(?:because|since|so that|and then|and also|but|or)\b", value, 1)[0].strip()
    return value[:120]


def _tokens(text: str) -> set:
    return {t.lower() for t in TOKEN_RE.findall(text or "") if len(t) > 2}


def extract_facts(message: str) -> list:
    text = (message or "").strip()
    lowered = text.lower()
    facts = []
    seen = set()

    for fact_type, patterns in FACT_RULES.items():
        for pattern in patterns:
            for match in re.finditer(pattern, lowered, flags=re.IGNORECASE):
                value = _clean_value(match.group(1))
                if not value:
                    continue
                normalized = value.lower()
                key = (fact_type, normalized)
                if key in seen:
                    continue
                seen.add(key)
                facts.append(
                    {
                        "fact_type": fact_type,
                        "fact_value": value,
                        "normalized_value": normalized,
                    }
                )

    return facts


def save_to_memory(user_id: str, user_msg: str, bot_reply: str):
    now = datetime.utcnow()

    # Store the conversation note too, so memory can still use useful snippets.
    db.memory_notes.insert_one(
        {
            "user_id": user_id,
            "user_msg": user_msg,
            "bot_reply": bot_reply,
            "created_at": now,
        }
    )

    # Store extracted long-term facts separately.
    for fact in extract_facts(user_msg):
        existing = db.memory_facts.find_one(
            {
                "user_id": user_id,
                "fact_type": fact["fact_type"],
                "normalized_value": fact["normalized_value"],
            }
        )

        if existing:
            db.memory_facts.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "fact_value": fact["fact_value"],
                        "source_message": user_msg,
                        "last_seen_at": now,
                    },
                    "$inc": {"occurrences": 1},
                },
            )
        else:
            db.memory_facts.insert_one(
                {
                    "user_id": user_id,
                    "fact_type": fact["fact_type"],
                    "fact_value": fact["fact_value"],
                    "normalized_value": fact["normalized_value"],
                    "source_message": user_msg,
                    "created_at": now,
                    "last_seen_at": now,
                    "occurrences": 1,
                }
            )


def _score_fact(fact: dict, query_tokens: set, current_message: str) -> float:
    fact_text = f"{fact.get('fact_type', '')} {fact.get('fact_value', '')} {fact.get('source_message', '')}"
    fact_tokens = _tokens(fact_text)
    overlap = len(query_tokens & fact_tokens)

    score = overlap * 3.0

    current_lower = current_message.lower()
    if fact.get("normalized_value") and fact["normalized_value"] in current_lower:
        score += 4.0

    fact_type = fact.get("fact_type", "")
    if fact_type in {"name", "study", "goal", "work", "location", "preference"}:
        score += 1.0

    last_seen = fact.get("last_seen_at")
    if last_seen:
        age_days = max((datetime.utcnow() - last_seen).days, 0)
        score += max(0.0, 2.0 - (age_days / 30.0))

    score += min(int(fact.get("occurrences", 1)), 3) * 0.3
    return score


def _score_note(note: dict, query_tokens: set, current_message: str) -> float:
    text = f"{note.get('user_msg', '')} {note.get('bot_reply', '')}"
    note_tokens = _tokens(text)
    overlap = len(query_tokens & note_tokens)

    score = overlap * 2.0
    if overlap > 0 and note.get("user_msg"):
        score += 1.0

    created_at = note.get("created_at")
    if created_at:
        age_days = max((datetime.utcnow() - created_at).days, 0)
        score += max(0.0, 1.5 - (age_days / 30.0))

    return score


def get_memory_context(user_id: str, current_message: str) -> str:
    query_tokens = _tokens(current_message)

    facts = list(
        db.memory_facts.find({"user_id": user_id})
        .sort("last_seen_at", -1)
        .limit(100)
    )

    scored_facts = []
    for fact in facts:
        score = _score_fact(fact, query_tokens, current_message)
        if score > 0:
            scored_facts.append((score, fact))

    scored_facts.sort(key=lambda x: x[0], reverse=True)
    top_facts = [fact for _, fact in scored_facts[:5]]

    notes = list(
        db.memory_notes.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(20)
    )

    scored_notes = []
    for note in notes:
        score = _score_note(note, query_tokens, current_message)
        if score > 0:
            scored_notes.append((score, note))

    scored_notes.sort(key=lambda x: x[0], reverse=True)
    top_notes = [note for _, note in scored_notes[:2]]

    parts = []

    if top_facts:
        parts.append("[Relevant long-term memory]")
        for fact in top_facts:
            label = fact["fact_type"].replace("_", " ").title()
            parts.append(f"- {label}: {fact['fact_value']}")

    if top_notes:
        parts.append("[Relevant recent conversation snippets]")
        for note in top_notes:
            u = note.get("user_msg", "")
            b = note.get("bot_reply", "")
            parts.append(f"- User: {u}")
            parts.append(f"  Bot: {b}")

    if not parts:
        return ""

    parts.append("[End memory]")
    return "\n".join(parts)