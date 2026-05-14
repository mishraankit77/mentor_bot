import os, httpx
from dotenv import load_dotenv
from database import get_recent_for_prompt
load_dotenv()

SYSTEM_PROMPT = """You are MentorBot — a warm, smart, and personalized AI mentor.
- You REMEMBER the user from past conversations (context is given to you)
- You give specific, actionable advice — not generic answers
- You are empathetic — if the user seems stressed, acknowledge it first
- Keep responses concise (3-5 sentences) unless deep explanation is needed
- Never say "As an AI" — you are their personal mentor"""

def get_ai_response(user_id: str, user_message: str, memory_context: str,
                    emotion_instruction: str = "", goals_context: str = "") -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if emotion_instruction:
        messages.append({"role": "system", "content": emotion_instruction})
    if memory_context:
        messages.append({"role": "system", "content": memory_context})
    if goals_context:
        messages.append({"role": "system", "content": goals_context})

    for msg in get_recent_for_prompt(user_id):
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    from openai import OpenAI
    client = OpenAI(
        api_key=os.getenv("GROQ_API_KEY"),
        base_url="https://api.groq.com/openai/v1",
        http_client=httpx.Client()
    )
    res = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=messages,
        max_tokens=500,
        temperature=0.7
    )
    return res.choices[0].message.content