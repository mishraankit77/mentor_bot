import hashlib
import hmac
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional
from urllib.parse import urlencode

import httpx
import redis

from bson import ObjectId
from dotenv import load_dotenv
from email_validator import EmailNotValidError, validate_email
from fastapi import HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import db

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET is required")

ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "7"))

ACCESS_COOKIE_NAME = os.getenv("ACCESS_COOKIE_NAME", "mentor_access")
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "mentor_refresh")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/auth/github/callback")

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER
OTP_HASH_SECRET = os.getenv("OTP_HASH_SECRET", JWT_SECRET)

OTP_TTL_SECONDS = 10 * 60
OAUTH_STATE_TTL_SECONDS = 10 * 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str, *, check_deliverability: bool = True) -> str:
    try:
        info = validate_email(email, check_deliverability=check_deliverability)
        return info.normalized.lower()
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_token(user_id: str, token_type: str, expires_delta: timedelta) -> tuple[str, dict]:
    exp = _utcnow() + expires_delta
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "jti": secrets.token_urlsafe(16),
        "iat": int(_utcnow().timestamp()),
        "exp": int(exp.timestamp()),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)
    return token, payload


def _decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    if payload.get("type") != expected_type:
        raise HTTPException(status_code=401, detail="Invalid token type")

    if not payload.get("sub") or not payload.get("jti"):
        raise HTTPException(status_code=401, detail="Invalid token")

    deny_key = f"deny:{expected_type}:{payload['jti']}"
    if redis_client.get(deny_key):
        raise HTTPException(status_code=401, detail="Token revoked")

    return payload


def _issue_session(user_id: str) -> tuple[str, str]:
    access_token, _ = _create_token(
        user_id=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=ACCESS_TOKEN_MINUTES),
    )
    refresh_token, refresh_payload = _create_token(
        user_id=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=REFRESH_TOKEN_DAYS),
    )
    ttl_seconds = REFRESH_TOKEN_DAYS * 24 * 60 * 60
    redis_client.setex(f"refresh:{user_id}:{refresh_payload['jti']}", ttl_seconds, "1")
    return access_token, refresh_token


def _set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        path="/auth/refresh",
    )


def _clear_auth_cookies(response) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/", domain=COOKIE_DOMAIN)
    response.delete_cookie(REFRESH_COOKIE_NAME, path="/auth/refresh", domain=COOKIE_DOMAIN)


def _payload(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "email_verified": bool(doc.get("email_verified", False)),
        "role": doc.get("role", "user"),
        "provider": doc.get("provider", "local"),
    }


def _get_bearer_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return request.cookies.get(ACCESS_COOKIE_NAME)


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = None,
) -> dict:
    token = _get_bearer_token(request, credentials)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = _decode_token(token, expected_type="access")
    doc = db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")

    return _payload(doc)


def _otp_key(email: str) -> str:
    return f"otp:{email.lower()}"


def _otp_hash(email: str, otp: str) -> str:
    return hmac.new(
        OTP_HASH_SECRET.encode(),
        f"{email.lower()}:{otp}".encode(),
        hashlib.sha256,
    ).hexdigest()


def _send_email(to_email: str, subject: str, body: str) -> None:
    if not all([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM]):
        raise HTTPException(status_code=500, detail="Email service not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASS)
        smtp.send_message(message)


def _generate_and_send_otp(email: str, *, require_user: bool) -> None:
    normalized = _normalize_email(email, check_deliverability=True)

    if require_user and not db.users.find_one({"email": normalized}):
        raise HTTPException(status_code=404, detail="User not found")

    otp = f"{secrets.randbelow(1_000_000):06d}"
    redis_client.setex(_otp_key(normalized), OTP_TTL_SECONDS, _otp_hash(normalized, otp))

    _send_email(
        normalized,
        "Verify your MentorBot email",
        f"Your MentorBot verification code is: {otp}\n\nThis code expires in 10 minutes.",
    )


def resend_email_otp(email: str) -> dict:
    _generate_and_send_otp(email, require_user=True)
    return {"message": "OTP sent again"}


def register_user(name: str, email: str, password: str, response=None) -> dict:
    normalized_email = _normalize_email(email, check_deliverability=True)

    if db.users.find_one({"email": normalized_email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "name": name.strip(),
        "email": normalized_email,
        "password": hash_password(password),
        "role": "user",
        "provider": "local",
        "provider_id": None,
        "email_verified": False,
        "created_at": _utcnow(),
        "updated_at": _utcnow(),
    }

    result = db.users.insert_one(user_doc)

    try:
        _generate_and_send_otp(normalized_email, require_user=False)
    except Exception:
        db.users.delete_one({"_id": result.inserted_id})
        raise

    return {
        "message": "Registration successful. OTP sent to your email.",
        "requires_verification": True,
        "user": {
            "id": str(result.inserted_id),
            "name": user_doc["name"],
            "email": normalized_email,
            "email_verified": False,
            "role": "user",
        },
    }


def login_user(email: str, password: str, response) -> dict:
    normalized_email = _normalize_email(email, check_deliverability=False)
    doc = db.users.find_one({"email": normalized_email})

    if not doc or not verify_password(password, doc.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not doc.get("email_verified", False):
        raise HTTPException(status_code=403, detail="Please verify your email first")

    access_token, refresh_token = _issue_session(str(doc["_id"]))
    _set_auth_cookies(response, access_token, refresh_token)
    return {"user": _payload(doc)}


def verify_email_otp(email: str, otp: str, response) -> dict:
    normalized_email = _normalize_email(email, check_deliverability=False)
    key = _otp_key(normalized_email)
    stored = redis_client.get(key)

    if not stored:
        raise HTTPException(status_code=400, detail="OTP expired or missing")

    if not hmac.compare_digest(stored, _otp_hash(normalized_email, otp.strip())):
        raise HTTPException(status_code=400, detail="Invalid OTP")

    redis_client.delete(key)

    db.users.update_one(
        {"email": normalized_email},
        {"$set": {"email_verified": True, "updated_at": _utcnow()}},
    )
    doc = db.users.find_one({"email": normalized_email})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")

    access_token, refresh_token = _issue_session(str(doc["_id"]))
    _set_auth_cookies(response, access_token, refresh_token)
    return {"message": "Email verified", "user": _payload(doc)}


def refresh_access_token(request: Request, response) -> dict:
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    refresh_payload = _decode_token(refresh_token, expected_type="refresh")
    session_key = f"refresh:{refresh_payload['sub']}:{refresh_payload['jti']}"
    if not redis_client.get(session_key):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    doc = db.users.find_one({"_id": ObjectId(refresh_payload["sub"])})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")

    access_token, _ = _create_token(
        user_id=refresh_payload["sub"],
        token_type="access",
        expires_delta=timedelta(minutes=ACCESS_TOKEN_MINUTES),
    )
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )
    return {"user": _payload(doc)}


def logout_user(request: Request, response) -> dict:
    access_token = request.cookies.get(ACCESS_COOKIE_NAME)
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if access_token:
        try:
            access_payload = _decode_token(access_token, expected_type="access")
            redis_client.setex(
                f"deny:access:{access_payload['jti']}",
                max(1, access_payload["exp"] - int(_utcnow().timestamp())),
                "1",
            )
        except HTTPException:
            pass

    if refresh_token:
        try:
            refresh_payload = _decode_token(refresh_token, expected_type="refresh")
            redis_client.delete(f"refresh:{refresh_payload['sub']}:{refresh_payload['jti']}")
        except HTTPException:
            pass

    _clear_auth_cookies(response)
    return {"message": "Logged out"}


def _oauth_state_key(provider: str, state: str) -> str:
    return f"oauth_state:{provider}:{state}"


def _create_oauth_state(provider: str) -> str:
    state = secrets.token_urlsafe(24)
    redis_client.setex(_oauth_state_key(provider, state), OAUTH_STATE_TTL_SECONDS, "1")
    return state


def _consume_oauth_state(provider: str, state: str) -> None:
    key = _oauth_state_key(provider, state)
    if not redis_client.get(key):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    redis_client.delete(key)


def _upsert_social_user(provider: str, provider_id: str, email: str, name: str, email_verified: bool) -> dict:
    normalized_email = _normalize_email(email, check_deliverability=False)
    doc = db.users.find_one(
        {
            "$or": [
                {"provider": provider, "provider_id": provider_id},
                {"email": normalized_email},
            ]
        }
    )

    now = _utcnow()

    if doc:
        db.users.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "name": name or doc.get("name", ""),
                    "email": normalized_email,
                    "provider": provider,
                    "provider_id": provider_id,
                    "email_verified": True if email_verified else bool(doc.get("email_verified", False)),
                    "updated_at": now,
                }
            },
        )
        return db.users.find_one({"_id": doc["_id"]})

    result = db.users.insert_one(
        {
            "name": name or normalized_email.split("@")[0],
            "email": normalized_email,
            "password": None,
            "role": "user",
            "provider": provider,
            "provider_id": provider_id,
            "email_verified": True if email_verified else False,
            "created_at": now,
            "updated_at": now,
        }
    )
    return db.users.find_one({"_id": result.inserted_id})


def google_start() -> RedirectResponse:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")

    state = _create_oauth_state("google")
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
        "state": state,
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}", status_code=302)


async def google_callback(code: str, state: str) -> RedirectResponse:
    _consume_oauth_state("google", state)

    async with httpx.AsyncClient(timeout=20) as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
        )
        token_res.raise_for_status()
        token_data = token_res.json()

        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Google login failed")

        profile_res = await client.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        profile_res.raise_for_status()
        profile = profile_res.json()

    email = profile.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google account email missing")

    user = _upsert_social_user(
        provider="google",
        provider_id=str(profile.get("sub", "")),
        email=email,
        name=profile.get("name") or email.split("@")[0],
        email_verified=bool(profile.get("email_verified", False)),
    )

    response = RedirectResponse(FRONTEND_URL, status_code=302)
    access_token, refresh_token = _issue_session(str(user["_id"]))
    _set_auth_cookies(response, access_token, refresh_token)
    return response


def github_start() -> RedirectResponse:
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    state = _create_oauth_state("github")
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_REDIRECT_URI,
        "scope": "read:user user:email",
        "state": state,
    }
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{urlencode(params)}", status_code=302)


async def github_callback(code: str, state: str) -> RedirectResponse:
    _consume_oauth_state("github", state)

    async with httpx.AsyncClient(timeout=20) as client:
        token_res = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_REDIRECT_URI,
            },
        )
        token_res.raise_for_status()
        token_data = token_res.json()

        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="GitHub login failed")

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "MentorBot",
        }

        profile_res = await client.get("https://api.github.com/user", headers=headers)
        profile_res.raise_for_status()
        profile = profile_res.json()

        emails_res = await client.get("https://api.github.com/user/emails", headers=headers)
        emails_res.raise_for_status()
        emails = emails_res.json()

    primary_email = next(
        (item["email"] for item in emails if item.get("primary") and item.get("verified")),
        None,
    )
    if not primary_email:
        raise HTTPException(status_code=400, detail="Verified GitHub email not found")

    user = _upsert_social_user(
        provider="github",
        provider_id=str(profile.get("id", "")),
        email=primary_email,
        name=profile.get("name") or profile.get("login") or primary_email.split("@")[0],
        email_verified=True,
    )

    response = RedirectResponse(FRONTEND_URL, status_code=302)
    access_token, refresh_token = _issue_session(str(user["_id"]))
    _set_auth_cookies(response, access_token, refresh_token)
    return response



