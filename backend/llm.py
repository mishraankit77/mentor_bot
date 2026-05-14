"""
llm.py  -- LLM calls to Groq
"""

import os
import httpx
import base64
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are MentorBot — a warm, smart, and personalized AI mentor.
- You REMEMBER the user from past conversations (long-term memory and recent messages are given to you above)
- You give specific, actionable advice — not generic answers
- You are empathetic — if the user seems stressed, acknowledge it first
- Keep responses concise (3-5 sentences) unless deep explanation is needed
- Never say "As an AI" — you are their personal mentor
- Reference things from memory naturally, like a real mentor would"""

TEXT_MODEL = "llama-3.1-8b-instant"
VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"


def _client():
    from openai import OpenAI

    return OpenAI(
        api_key=os.getenv("GROQ_API_KEY"),
        base_url="https://api.groq.com/openai/v1",
        http_client=httpx.Client()
    )


def get_ai_response(
    user_id: str,
    user_message: str,
    memory_context: str,
    emotion_instruction: str = "",
    goals_context: str = ""
) -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if emotion_instruction:
        messages.append({"role": "system", "content": emotion_instruction})

    if memory_context:
        messages.append({"role": "system", "content": memory_context})

    if goals_context:
        messages.append({"role": "system", "content": goals_context})

    messages.append({"role": "user", "content": user_message})

    res = _client().chat.completions.create(
        model=TEXT_MODEL,
        messages=messages,
        max_tokens=500,
        temperature=0.7
    )

    return res.choices[0].message.content


def analyze_image(
    image_bytes: bytes,
    content_type: str,
    filename: str = "uploaded image"
) -> str:
    """
    Uses Groq vision model to understand uploaded images.
    Works well for screenshots, UI bugs, diagrams, notes, and images with text.
    """
    mime = content_type or "image/png"

    if mime not in {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}:
        mime = "image/png"

    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime};base64,{base64_image}"

    prompt = (
        f"The user uploaded an image named '{filename}'. "
        "Analyze it carefully. If it contains text, extract the important text. "
        "If it is a screenshot, explain what is visible and identify any likely issue. "
        "If it is a diagram or document, summarize the key information. "
        "Return a helpful, concise description that can be passed to a mentor chatbot."
    )

    res = _client().chat.completions.create(
        model=VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url
                        }
                    }
                ]
            }
        ],
        max_tokens=700,
        temperature=0.2
    )

    return res.choices[0].message.content.strip()
