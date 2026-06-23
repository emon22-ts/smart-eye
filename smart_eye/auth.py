"""
Lightweight, dependency-free auth utilities for Smart Eye.

- Passwords: PBKDF2-HMAC-SHA256 (hashlib) with a per-user random salt.
- Tokens:   compact HS256 (HMAC-SHA256) signed tokens in JWT layout, signed with
            SMART_EYE_SECRET, verified with constant-time comparison + expiry.
- Google:   standard OAuth 2.0 authorization-code flow via urllib (stdlib). Needs
            GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET; otherwise google_configured()
            is False and the API reports the button as unconfigured (never faked).

Deliberately simple for an academic project running locally. For production prefer
a vetted library (Authlib / PyJWT), real session storage, and HTTPS everywhere.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.parse
import urllib.request
from typing import Optional

SECRET = os.environ.get("SMART_EYE_SECRET", "dev-insecure-change-me")
_PBKDF2_ROUNDS = 200_000

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.environ.get(
    "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
)
FRONTEND_URL = os.environ.get("SMART_EYE_FRONTEND_URL", "http://localhost:5173")

_GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo"


# --------------------------- base64url helpers --------------------------- #
def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


# ------------------------------- passwords ------------------------------- #
def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${_b64e(salt)}${_b64e(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), _b64d(salt_b64), int(rounds))
        return hmac.compare_digest(dk, _b64d(hash_b64))
    except Exception:
        return False


# ----------------------------- tokens (HS256) ---------------------------- #
def make_token(claims: dict, ttl_seconds: int = 7 * 24 * 3600) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = dict(claims)
    payload["exp"] = int(time.time()) + ttl_seconds
    h = _b64e(json.dumps(header, separators=(",", ":")).encode())
    p = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(SECRET.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{_b64e(sig)}"


def verify_token(token: str) -> Optional[dict]:
    try:
        h, p, s = token.split(".")
        expected = hmac.new(SECRET.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64d(s)):
            return None
        payload = json.loads(_b64d(p))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def user_id_from_header(authorization: Optional[str]) -> Optional[int]:
    """Extract a verified user id from an 'Authorization: Bearer <token>' header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    payload = verify_token(authorization.split(" ", 1)[1].strip())
    return payload.get("uid") if payload else None


# ----------------------------- google oauth ------------------------------ #
def google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def make_state() -> str:
    # signed, short-lived CSRF state — no server-side session required
    return make_token({"k": "oauth_state", "n": secrets.token_hex(8)}, ttl_seconds=600)


def google_login_url(state: str) -> str:
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{_GOOGLE_AUTH}?{urllib.parse.urlencode(params)}"


def google_exchange(code: str) -> dict:
    """Exchange an authorization code for the user's profile {email, name, sub}."""
    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        }
    ).encode()
    req = urllib.request.Request(_GOOGLE_TOKEN, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        tok = json.loads(resp.read().decode())
    access = tok.get("access_token")
    if not access:
        raise RuntimeError("google token exchange failed")
    ui_req = urllib.request.Request(_GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access}"})
    with urllib.request.urlopen(ui_req, timeout=15) as resp:
        info = json.loads(resp.read().decode())
    return {
        "email": info.get("email"),
        "name": info.get("name") or info.get("email"),
        "sub": info.get("sub"),
    }
