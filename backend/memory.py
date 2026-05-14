import os
import httpx
from dotenv import load_dotenv
from database import (
    get_summary,
    save_summary,
    get_recent_messages,
    count_messages,
    get_chat_history
)

load_dotenv()

SUMMARIZE_EVERY = 10
RECENT_TURNS = 6

def get_memory_context(user_id: str, session_id: str = None) -> str:
    summary = get_summary(user_id)
    recent = get_recent_messages(user_id, limit=RECENT_TURNS, session_id=session_id)

    parts = []

    if summary:
        parts.append(
            "[LONG-TERM MEMORY — summarized from past conversations]\n"
            f"{summary}\n"
            "[END LONG-TERM MEMORY]"
        )

    if recent:
        lines = ["[RECENT CONVERSATION — current chat session]"]
        for m in recent:
            speaker = "User" if m["role"] == "user" else "MentorBot"
            lines.append(f"  {speaker}: {m['content']}")
        lines.append("[END RECENT CONVERSATION]")
        parts.append("\n".join(lines))

    return "\n\n".join(parts) if parts else ""

def maybe_summarize(user_id: str) -> None:
    total = count_messages(user_id)

    if total == 0 or total % SUMMARIZE_EVERY != 0:
        return

    history = get_chat_history(user_id, limit=200)
    if not history:
        return

    convo_text = "\n".join(
        f"{'User' if m['role'] == 'user' else 'MentorBot'}: {m['content']}"
        for m in history
    )

    existing_summary = get_summary(user_id)
    prior_context = (
        f"Previous summary of even earlier conversations:\n{existing_summary}\n\n"
        if existing_summary else ""
    )

    prompt = (
        f"{prior_context}"
        "Here is the full conversation history so far:\n\n"
        f"{convo_text}\n\n"
        "Write a concise paragraph (5-8 sentences) summarizing:\n"
        "- The user's name, goals, and what they are trying to learn or achieve\n"
        "- Key topics discussed and important advice given\n"
        "- The user's current emotional patterns or mindset\n"
        "- Any personal details mentioned, such as exams, job, or projects\n"
        "Write in third person. Be specific, not generic. "
        "This will be used as memory for a future conversation."
    )

    new_summary = _call_llm(prompt)
    if new_summary:
        save_summary(user_id, new_summary)

def _call_llm(prompt: str) -> str:
    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=os.getenv("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
            http_client=httpx.Client()
        )

        res = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "system",
                    "content": "You are a memory assistant. Summarize conversations accurately and concisely."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=300,
            temperature=0.3
        )

        return res.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Memory] Summarization failed: {e}")
        return ""
