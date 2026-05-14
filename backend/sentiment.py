# sentiment.py - Detect user's emotion from their message
# Uses keyword-based detection (no extra packages needed!)

EMOTION_KEYWORDS = {
    "stressed": [
        "stressed", "stress", "overwhelmed", "anxious", "anxiety", "worried",
        "nervous", "panic", "scared", "fear", "pressure", "burden", "exhausted",
        "burnout", "cant handle", "too much", "falling behind", "behind schedule"
    ],
    "sad": [
        "sad", "depressed", "unhappy", "crying", "hopeless", "useless",
        "worthless", "failure", "failed", "give up", "no point", "lost",
        "lonely", "alone", "nobody", "nothing matters", "upset", "hurt"
    ],
    "angry": [
        "angry", "frustrated", "annoyed", "irritated", "mad", "hate",
        "furious", "sick of", "fed up", "ridiculous", "unfair", "stupid"
    ],
    "confused": [
        "confused", "dont understand", "no idea", "lost", "stuck",
        "not sure", "what should", "how do i", "dont know", "unclear",
        "help me understand", "explain"
    ],
    "motivated": [
        "excited", "motivated", "ready", "confident", "happy", "great",
        "awesome", "lets go", "pumped", "energetic", "positive", "good mood",
        "feeling good", "determined", "focused", "productive"
    ],
    "neutral": []
}

# How MentorBot should respond based on emotion
EMOTION_INSTRUCTIONS = {
    "stressed": """The user seems STRESSED or ANXIOUS right now.
- First acknowledge their stress with empathy (1 sentence)
- Reassure them that it's okay to feel this way
- Then give calm, simple, actionable advice
- Keep tone soft and supportive, not pushy""",

    "sad": """The user seems SAD or DEMOTIVATED right now.
- Start with genuine empathy and validation
- Do NOT jump straight to advice
- Ask one caring question to understand better
- Be warm, gentle, and encouraging""",

    "angry": """The user seems FRUSTRATED or ANGRY right now.
- Acknowledge their frustration first
- Do not dismiss their feelings
- Stay calm and be solution-focused
- Help them channel frustration into action""",

    "confused": """The user seems CONFUSED or LOST right now.
- Be extra clear and structured in your response
- Break things down into simple steps
- Use examples where possible
- Ask if they want you to explain anything further""",

    "motivated": """The user is MOTIVATED and ENERGETIC right now.
- Match their energy with enthusiasm
- Give them ambitious, actionable next steps
- Push them a little — they can handle it
- Celebrate their positive mindset""",

    "neutral": """The user seems calm and neutral.
- Be helpful, clear and professional
- Give balanced advice"""
}


def detect_emotion(message: str) -> str:
    """
    Detect emotion from user message using keyword matching.
    Returns: 'stressed', 'sad', 'angry', 'confused', 'motivated', or 'neutral'
    """
    message_lower = message.lower()

    scores = {emotion: 0 for emotion in EMOTION_KEYWORDS}

    for emotion, keywords in EMOTION_KEYWORDS.items():
        for keyword in keywords:
            if keyword in message_lower:
                scores[emotion] += 1

    # Find emotion with highest score
    best_emotion = max(scores, key=scores.get)

    # If no keywords matched, return neutral
    if scores[best_emotion] == 0:
        return "neutral"

    return best_emotion


def get_emotion_instruction(message: str) -> str:
    """
    Returns instruction for LLM based on detected emotion.
    This gets injected into the AI prompt.
    """
    emotion = detect_emotion(message)
    instruction = EMOTION_INSTRUCTIONS.get(emotion, EMOTION_INSTRUCTIONS["neutral"])
    return f"[EMOTION DETECTED: {emotion.upper()}]\n{instruction}"


def get_emotion_emoji(emotion: str) -> str:
    """Returns emoji for each emotion (used in API response)"""
    emojis = {
        "stressed": "😰",
        "sad": "😔",
        "angry": "😤",
        "confused": "😕",
        "motivated": "🔥",
        "neutral": "😊"
    }
    return emojis.get(emotion, "😊")
