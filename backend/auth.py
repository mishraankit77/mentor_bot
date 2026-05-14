"""
auth.py  ── JWT-based authentication
=====================================
WHY THIS FILE IS NEW:
  Before: Login only stored name+email in MongoDB with no password.
          Anyone could impersonate any user by typing their email.
          No tokens, no session security whatsoever.

  After:  Real password hashing with bcrypt + JWT tokens.
    1. On register/login → password is hashed with bcrypt (never stored plain)
    2. On success → server returns a signed JWT token (expires in 7 days)
    3. Every protected route checks the token via get_current_user()
    4. If token is missing or tampered → 401 Unauthorized

  HOW IT WORKS FOR THE USER:
    - Register once with name, email, password
    - Login gets a token → stored in localStorage on the frontend
    - Every API call sends the token in the Authorization header
    - The server verifies it without hitting the database each time
"""

import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext  # type: ignore
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv
from database import db
from bson import ObjectId

load_dotenv()

# Secret key — set a strong random value in your .env file
SECRET_KEY        = os.getenv("JWT_SECRET", "change-this-to-a-long-random-string-in-production")
ALGORITHM         = "HS256"
TOKEN_EXPIRE_DAYS = 7

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ── Password helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── Token helpers ──────────────────────────────────────────────────────────────

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> str:
    """Returns user_id from a valid token, raises HTTPException otherwise."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")


# ── FastAPI dependency ─────────────────────────────────────────────────────────

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    FastAPI dependency. Add to any route that needs authentication:
        @app.get("/protected")
        def protected(user=Depends(get_current_user)):
            ...
    Returns: {"id": "...", "name": "...", "email": "..."}
    """
    user_id = decode_token(token)
    doc = db.users.find_one({"_id": ObjectId(user_id)})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return {
        "id":    str(doc["_id"]),
        "name":  doc["name"],
        "email": doc["email"]
    }


# ── Register / Login logic ─────────────────────────────────────────────────────

def register_user(name: str, email: str, password: str) -> dict:
    """
    Creates a new user. Returns token on success.
    Raises HTTPException if email already exists.
    """
    if db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    result = db.users.insert_one({
        "name":       name,
        "email":      email,
        "password":   hash_password(password),
        "created_at": datetime.utcnow()
    })
    user_id = str(result.inserted_id)
    return {"token": create_token(user_id), "user_id": user_id, "name": name}


def login_user(email: str, password: str) -> dict:
    """
    Verifies credentials. Returns token on success.
    Raises HTTPException if credentials are wrong.

    FIX: Added guard for old accounts that were created before
    the password field existed (stored_hash would be empty string).
    Previously this caused a passlib.exc.UnknownHashError crash.
    Now it returns a clean 401 instead.
    """
    doc         = db.users.find_one({"email": email})
    stored_hash = doc.get("password", "") if doc else ""

    # Guard: no user found OR old account with no password hash stored
    if not doc or not stored_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Guard: wrong password
    if not verify_password(password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(doc["_id"])
    return {"token": create_token(user_id), "user_id": user_id, "name": doc["name"]}


    filename = (file.filename or "uploaded-file").lower()
    content_type = file.content_type or ""

    if filename.endswith(".pdf") or content_type == "application/pdf":
        reader = PdfReader(BytesIO(data))
        pages = []

        for i, page in enumerate(reader.pages[:20], start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"[Page {i}]\n{text.strip()}")

        return "\n\n".join(pages).strip()

    if (
        filename.endswith(".txt")
        or filename.endswith(".md")
        or filename.endswith(".csv")
        or content_type.startswith("text/")
    ):
        return data.decode("utf-8", errors="ignore").strip()

    if content_type.startswith("image/"):
        return (
            f"Image uploaded: {file.filename}\n"
            "Note: image OCR/vision is not enabled yet. Please describe the image or add OCR/vision support."
        )

    return data.decode("utf-8", errors="ignore").strip()
