"""
SQLite-backed store: screening sessions + user accounts.

Sessions are tagged with an optional user_id:
  - logged-in users see and manage only their own sessions;
  - guests / anonymous calls use the NULL bucket (preserving the original
    pre-auth behaviour, so nothing breaks for existing data).

A fresh connection is opened per call (thread-safe under FastAPI's threadpool)
and writes are serialised with a lock. Anonymous by design beyond the account
record: only scores, inputs and a UTC timestamp are stored per session.
"""
from __future__ import annotations

import json
import os
import sqlite3
import threading
import time
from typing import List, Optional

_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_DIR, "sessions.db")
_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _columns(c, table: str) -> set:
    return {row["name"] for row in c.execute(f"PRAGMA table_info({table})").fetchall()}


def init_db() -> None:
    """Create tables if needed and migrate older schemas in place."""
    with _lock, _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at         TEXT    NOT NULL,
                ohi                REAL,
                band               TEXT,
                colour             TEXT,
                top_class          TEXT,
                top_confidence     REAL,
                is_mock            INTEGER,
                fatigue_score      REAL,
                symptoms_aggregate REAL,
                user_id            INTEGER,
                payload            TEXT    NOT NULL
            )
            """
        )
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT    UNIQUE NOT NULL,
                name          TEXT,
                password_hash TEXT,
                google_sub    TEXT,
                created_at    TEXT    NOT NULL
            )
            """
        )
        # migrate a sessions table created before user accounts existed
        if "user_id" not in _columns(c, "sessions"):
            c.execute("ALTER TABLE sessions ADD COLUMN user_id INTEGER")


# ------------------------------- sessions -------------------------------- #
def save_session(summary: dict, user_id: Optional[int] = None) -> int:
    ohi = summary.get("ohi") or {}
    disease = summary.get("disease") or {}
    fatigue = summary.get("fatigue") or {}
    created = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with _lock, _conn() as c:
        cur = c.execute(
            """
            INSERT INTO sessions
                (created_at, ohi, band, colour, top_class, top_confidence,
                 is_mock, fatigue_score, symptoms_aggregate, user_id, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created,
                ohi.get("ohi"),
                ohi.get("band"),
                ohi.get("colour"),
                disease.get("top_class"),
                disease.get("top_confidence"),
                1 if disease.get("is_mock") else 0,
                fatigue.get("fatigue_score"),
                summary.get("symptoms_aggregate"),
                user_id,
                json.dumps(summary),
            ),
        )
        return int(cur.lastrowid)


def list_sessions(limit: int = 100, user_id: Optional[int] = None) -> List[dict]:
    # `IS ?` matches NULL when user_id is None (guest bucket), or equals an id.
    with _lock, _conn() as c:
        rows = c.execute(
            """
            SELECT id, created_at, ohi, band, colour, top_class,
                   top_confidence, is_mock, fatigue_score, symptoms_aggregate
            FROM sessions WHERE user_id IS ? ORDER BY id DESC LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]


def get_session(sid: int, user_id: Optional[int] = None) -> Optional[dict]:
    with _lock, _conn() as c:
        row = c.execute(
            "SELECT payload FROM sessions WHERE id = ? AND user_id IS ?", (sid, user_id)
        ).fetchone()
        if row is None:
            return None
        data = json.loads(row["payload"])
        data["session_id"] = sid
        return data


def delete_session(sid: int, user_id: Optional[int] = None) -> bool:
    with _lock, _conn() as c:
        cur = c.execute("DELETE FROM sessions WHERE id = ? AND user_id IS ?", (sid, user_id))
        return cur.rowcount > 0


def count_sessions() -> int:
    with _lock, _conn() as c:
        return int(c.execute("SELECT COUNT(*) FROM sessions").fetchone()[0])


# -------------------------------- users ---------------------------------- #
def _row_to_user(row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "password_hash": row["password_hash"],
        "google_sub": row["google_sub"],
    }


def create_user(email: str, name: str, password_hash: Optional[str] = None,
                google_sub: Optional[str] = None) -> int:
    created = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with _lock, _conn() as c:
        try:
            cur = c.execute(
                "INSERT INTO users (email, name, password_hash, google_sub, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (email, name, password_hash, google_sub, created),
            )
            return int(cur.lastrowid)
        except sqlite3.IntegrityError as exc:
            raise ValueError("email already registered") from exc


def get_user_by_email(email: str) -> Optional[dict]:
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return _row_to_user(row) if row else None


def get_user_by_id(uid: int) -> Optional[dict]:
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
        return _row_to_user(row) if row else None


def get_user_by_google_sub(sub: str) -> Optional[dict]:
    with _lock, _conn() as c:
        row = c.execute("SELECT * FROM users WHERE google_sub = ?", (sub,)).fetchone()
        return _row_to_user(row) if row else None


def upsert_google_user(email: str, name: str, sub: str) -> dict:
    """Find a user by Google subject id, link by email, or create a new one."""
    existing = get_user_by_google_sub(sub)
    if existing:
        return existing
    by_email = get_user_by_email(email)
    if by_email:
        with _lock, _conn() as c:
            c.execute("UPDATE users SET google_sub = ? WHERE id = ?", (sub, by_email["id"]))
        by_email["google_sub"] = sub
        return by_email
    uid = create_user(email, name, password_hash=None, google_sub=sub)
    return get_user_by_id(uid)
