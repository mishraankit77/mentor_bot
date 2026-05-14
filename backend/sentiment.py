"""
sentiment.py  ── LLM-based emotion detection
=============================================
WHY THIS FILE CHANGED:
  Before: Keyword matching only. Failed on:
    - Short messages: "I'm not okay" → detected as 'neutral'
    - Negations: "not stressed" → scored as 'stressed'
    - Sarcasm: "Oh great, another failure" → detected as 'motivated'
    - No mixed emotions possible

  After: A fast LLM call classifies the emotion in context.
    - Understands negations ("I'm not stressed anymore" → motivated)
    - Handles short messages ("I'm fine" → neutral, "not okay" → sad)
    - Detects sarcasm with context
    - Returns a single label from a fixed set so downstream code
      still works exactly the same way

  PERFORMANCE NOTE: This adds ~200ms per message (one extra Groq call).
  It uses max_tokens=5 so it's as fast as possible — just one word back.

  FALLBACK: If the LLM call fails for any reason, the old keyword
  matching runs automatically so the bot never crashes.
"""

import os, httpx
from dotenv import load_dotenv

load_dotenv()

VALID_EMOTIONS = {"stressed", "sad", "angry", "confused", "motivated", "neutral"}

EMOTION_INSTRUCTIONS = {
    "stressed": """The user seems STRESSED or ANXIOUS.
- Acknowledge their stress first with empathy (1 sentence)
- Reassure them it is okay to feel this way
- Then give calm, simple, actionable advice
- Keep tone soft and supportive, not pushy""",

    "sad": """The user seems SAD or DEMOTIVATED.
- Start with genuine empathy and validation
- Do NOT jump straight to advice
- Ask one caring question to understand better
- Be warm, gentle, and encouraging""",

    "angry": """The user seems FRUSTRATED or ANGRY.
- Acknowledge their frustration first
- Do not dismiss their feelings
- Stay calm and be solution-focused
- Help them channel frustration into action""",

    "confused": """The user seems CONFUSED or LOST.
- Be extra clear and structured in your response
- Break things into simple steps
- Use examples where possible
- Ask if they want further explanation""",

    "motivated": """The user is MOTIVATED and ENERGETIC.
- Match their energy with enthusiasm
- Give ambitious, actionable next steps
- Push them a little — they can handle it
- Celebrate their positive mindset""",

    "neutral": """The user seems calm and neutral.
- Be helpful, clear, and professional
- Give balanced advice"""
}

EMOTION_EMOJIS = {
    "stressed":  "😰",
    "sad":       "😔",
    "angry":     "😤",
    "confused":  "😕",
    "motivated": "🔥",
    "neutral":   "😊"
}


# ── Primary: LLM-based detection ──────────────────────────────────────────────

def detect_emotion(message: str) -> str:
    """
    Sends the message to the LLM and asks for one-word emotion classification.
    Falls back to keyword matching if the LLM call fails.
    """
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
                    "content": (
                        "You are an emotion classifier. Given a user message, "
                        "reply with EXACTLY ONE word from this list:\n"
                        "stressed, sad, angry, confused, motivated, neutral\n"
                        "No punctuation. No explanation. One word only."
                    )
                },
                {"role": "user", "content": message}
            ],
            max_tokens=5,        # we only need one word
            temperature=0.0      # deterministic
        )
        label = res.choices[0].message.content.strip().lower().rstrip(".")
        return label if label in VALID_EMOTIONS else "neutral"
    except Exception as e:
        print(f"[Sentiment] LLM detection failed, using keyword fallback: {e}")
        return _keyword_fallback(message)


# ── Fallback: keyword matching ─────────────────────────────────────────────────

_KEYWORDS = {
    "stressed":  ["stressed","overwhelmed","anxious","worried","nervous","panic",
                  "pressure","burnout","exhausted","too much","falling behind"],
    "sad":       ["sad","depressed","unhappy","hopeless","useless","worthless",
                  "failure","give up","lonely","alone","nothing matters","upset"],
    "angry":     ["angry","frustrated","annoyed","irritated","mad","hate",
                  "furious","sick of","fed up","unfair"],
    "confused":  ["confused","dont understand","no idea","stuck","not sure",
                  "how do i","dont know","unclear","explain"],
    "motivated": ["excited","motivated","ready","confident","happy","great",
                  "awesome","pumped","energetic","positive","determined","focused"],
}

def _keyword_fallback(message: str) -> str:
    msg = message.lower()
    scores = {e: sum(1 for kw in kws if kw in msg) for e, kws in _KEYWORDS.items()}
    best   = max(scores, key=scores.get)
    return best if scores[best] > 0 else "neutral"


# ── Helpers used by main.py ────────────────────────────────────────────────────

def get_emotion_instruction(emotion: str) -> str:
    instruction = EMOTION_INSTRUCTIONS.get(emotion, EMOTION_INSTRUCTIONS["neutral"])
    return f"[EMOTION DETECTED: {emotion.upper()}]\n{instruction}"

def get_emotion_emoji(emotion: str) -> str:
    return EMOTION_EMOJIS.get(emotion, "😊")