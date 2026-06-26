"""
Auth + PDF integration tests.

Drives the FastAPI app in-process via httpx's ASGITransport (no running server
needed). Exercises registration, login, an authenticated /me call, and the PDF
report endpoint for a freshly-scored session. A unique email per run makes it safe
to re-run against the existing database.

Run:  pytest smart_eye/tests/test_auth_and_pdf.py -v -s
"""
from __future__ import annotations

import uuid

import httpx
import pytest

from smart_eye.orchestration.api import app

pytestmark = pytest.mark.asyncio

BASE = "http://testserver"


def _client():
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url=BASE)


async def test_health_reports_model():
    async with _client() as ac:
        r = await ac.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert "disease_model" in body
    print("\n[AUTH/PDF] health disease_model =", body["disease_model"], "is_mock =", body.get("is_mock"))


async def test_register_login_me_flow():
    email = "test_" + uuid.uuid4().hex[:10] + "@example.com"
    password = "TestPass123!"

    async with _client() as ac:
        r = await ac.post("/api/auth/register", json={"email": email, "password": password, "name": "Test User"})
        assert r.status_code == 200, "register failed: " + str(r.status_code) + " " + r.text
        tok = r.json().get("access_token") or r.json().get("token")
        assert tok, "no token on register: " + str(r.json())

        r = await ac.post("/api/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, "login failed: " + str(r.status_code) + " " + r.text
        tok = r.json().get("access_token") or r.json().get("token")
        assert tok, "no token on login"

        r = await ac.get("/api/auth/me", headers={"Authorization": "Bearer " + tok})
        assert r.status_code == 200, "/me failed: " + str(r.status_code) + " " + r.text
        body = r.json()
        me = body.get("user", body)  # supports {"user": {...}} or a flat object
        assert me.get("email") == email, "unexpected /me body: " + str(body)

    print("\n[AUTH/PDF] registered + logged in as", me.get("email"))


async def test_score_then_pdf_download():
    email = "pdf_" + uuid.uuid4().hex[:10] + "@example.com"
    async with _client() as ac:
        r = await ac.post("/api/auth/register", json={"email": email, "password": "TestPass123!", "name": "PDF User"})
        assert r.status_code == 200, "register failed: " + str(r.status_code) + " " + r.text
        tok = r.json().get("access_token") or r.json().get("token")
        assert tok, "no token on register"
        headers = {"Authorization": "Bearer " + tok}

        r = await ac.post("/api/session/score", params={
            "pain": 3, "redness": 2, "photophobia": 1, "blurred_vision": 2,
            "fatigue_score": 10, "drowsy": "false", "blink_rate_bpm": 15,
        }, headers=headers)
        assert r.status_code == 200, "score failed: " + str(r.status_code) + " " + r.text
        sid = r.json().get("session_id")
        assert sid is not None, "no session_id (signed-in should persist): " + str(r.json())

        r = await ac.get("/api/sessions/" + str(sid) + "/pdf", headers=headers)
        assert r.status_code == 200, "pdf failed: " + str(r.status_code) + " " + r.text
        ctype = r.headers.get("content-type", "")
        assert "pdf" in ctype.lower(), "unexpected content-type: " + ctype
        assert r.content[:5] == b"%PDF-", "response is not a valid PDF"

    print("\n[AUTH/PDF] session #" + str(sid) + " PDF generated,", len(r.content), "bytes")
