"""
FastAPI orchestration service.

Exposes the screening pipeline over HTTP and serves a minimal demo page. Run:

    pip install fastapi uvicorn python-multipart pillow numpy
    uvicorn smart_eye.orchestration.api:app --reload

The demo page deliberately shows the non-dismissible disclaimer AND a loud
"MOCK MODEL" banner whenever the active disease model is a placeholder, so the
screening output can never be mistaken for a real clinical result.
"""
from __future__ import annotations

import io
import time
import urllib.parse
from typing import Optional

import numpy as np
from fastapi import Body, FastAPI, File, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from .. import auth
from ..config import (
    DISCLAIMER,
    FRAME_PROCESSING_BUDGET_MS,
    IMAGE_INFERENCE_BUDGET_S,
)
from ..domain.disease_screening import load_default_model
from ..domain.fatigue_monitor import FatigueMonitor, average_ear
from ..persistence import store
from ..schemas import FatigueSnapshot, SymptomScores
from .orchestrator import ScreeningOrchestrator

from fastapi import Request

app = FastAPI(title="Smart Eye — Screening Orchestrator", version="0.1.0")

# CORS — allow the React/Vite dev server to call the API directly (i.e. when the
# frontend sets API_BASE to this origin rather than routing through the Vite
# proxy). Harmless to keep alongside the proxy. Add your deployed origin here too.
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single shared orchestrator. load_default_model() emits a startup warning if it
# is running on the mock fallback.
_MODEL = load_default_model()
_ORCH = ScreeningOrchestrator(disease_model=_MODEL)
# Per-process monitor for the simple demo; a real deployment keys this by session.
_MONITOR = FatigueMonitor()

# Initialise the SQLite session store (creates the table on first run).
store.init_db()


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    """Attach a Server-Timing header so latency budgets are observable."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000.0
    response.headers["Server-Timing"] = f"app;dur={elapsed_ms:.1f}"
    return response


def _decode_image(raw: bytes) -> np.ndarray:
    """Decode uploaded bytes to an array. Uses Pillow if available."""
    from PIL import Image  # lazy; pillow is light

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.asarray(img)


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return _DEMO_HTML.replace("__DISCLAIMER__", DISCLAIMER)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "disease_model": _MODEL.model_id,
        "is_mock": _MODEL.is_mock,
        "image_budget_s": IMAGE_INFERENCE_BUDGET_S,
        "frame_budget_ms": FRAME_PROCESSING_BUDGET_MS,
        "google_auth_configured": auth.google_configured(),
    }


@app.post("/api/screen/image")
async def screen_image(file: UploadFile = File(...)) -> JSONResponse:
    """Classify one uploaded anterior-segment image (mock unless a model is loaded)."""
    raw = await file.read()
    try:
        image = _decode_image(raw)
    except Exception as exc:
        return JSONResponse(status_code=422, content={"error": f"could not decode image: {exc}"})
    prediction = _MODEL.predict(image)
    return JSONResponse(prediction.dict())


@app.post("/api/screen/image/explain")
async def screen_image_explain(file: UploadFile = File(...), class_name: Optional[str] = None) -> JSONResponse:
    """Classify an image AND return a Grad-CAM heatmap overlay (base64 PNG data URI).
    Grad-CAM is only meaningful with the real CNN; the overlay is null if mock or on error."""
    raw = await file.read()
    try:
        image = _decode_image(raw)
    except Exception as exc:
        return JSONResponse(status_code=422, content={"error": f"could not decode image: {exc}"})

    prediction = _MODEL.predict(image)
    out = prediction.dict()

    from ..config import DISEASE_CLASSES
    class_idx = None
    explained_class = None
    if class_name and class_name in DISEASE_CLASSES:
        class_idx = list(DISEASE_CLASSES).index(class_name)
        explained_class = class_name
    from ..domain.gradcam import explain_image
    import numpy as np
    try:
        out["gradcam"] = explain_image(_MODEL, np.asarray(image), class_idx)
        out["gradcam_class"] = explained_class or out.get("top_class")
    except Exception:
        out["gradcam"] = None
        out["gradcam_class"] = None
    return JSONResponse(out)


@app.post("/api/fatigue/frame")
async def fatigue_frame(request: Request) -> dict:
    """Advance the fatigue monitor with one frame's 68 landmark coordinates.

    Reads the raw JSON body so it accepts either a bare array of 68 [x, y]
    pairs or an object {"landmarks_68": [...]}. Raw video never leaves the
    device; only coordinates are sent. Returns the fatigue snapshot.
    """
    t0 = time.perf_counter()
    try:
        body = await request.json()
        landmarks_68 = body["landmarks_68"] if isinstance(body, dict) else body
        ear = average_ear([tuple(p) for p in landmarks_68])
    except Exception:
        ear = None  # malformed landmarks -> treat as face lost, do not crash
    snap = _MONITOR.update(ear, None)
    proc_ms = (time.perf_counter() - t0) * 1000.0
    out = snap.dict()
    out["frame_processing_ms"] = round(proc_ms, 3)
    out["within_budget"] = proc_ms < FRAME_PROCESSING_BUDGET_MS
    return out


@app.post("/api/session/score")
async def session_score(
    file: Optional[UploadFile] = File(None),
    pain: int = 1,
    redness: int = 1,
    photophobia: int = 1,
    blurred_vision: int = 1,
    fatigue_score: float = 0.0,
    drowsy: bool = False,
    blink_rate_bpm: float = 0.0,
    authorization: Optional[str] = Header(None),
) -> JSONResponse:
    """Fuse image + symptoms + fatigue into the composite OHI and recommendation."""
    image = None
    if file is not None:
        raw = await file.read()
        if raw:
            try:
                image = _decode_image(raw)
            except Exception as exc:
                return JSONResponse(status_code=422, content={"error": str(exc)})

    symptoms = SymptomScores(
        pain=pain, redness=redness, photophobia=photophobia, blurred_vision=blurred_vision
    )
    fatigue = FatigueSnapshot(
        fatigue_score=fatigue_score, drowsy=drowsy, blink_rate_bpm=blink_rate_bpm
    )
    summary = _ORCH.score_session(image=image, symptoms=symptoms, fatigue=fatigue)

    payload = summary.dict()
    # nested pydantic/dataclass objects -> dicts for JSON
    for key in ("disease", "fatigue", "ohi", "recommendation"):
        obj = payload.get(key)
        if hasattr(obj, "dict"):
            payload[key] = obj.dict()

    # Persist the session (tagged with the user if signed in, else anonymous).
    try:
        uid = auth.user_id_from_header(authorization)
        payload["session_id"] = store.save_session(payload, user_id=uid)
    except Exception:
        payload["session_id"] = None  # never let a storage hiccup fail the screening

    return JSONResponse(payload)


@app.get("/api/sessions")
def list_sessions(limit: int = 100, authorization: Optional[str] = Header(None)) -> JSONResponse:
    """Recent sessions for the signed-in user (or the anonymous bucket for guests)."""
    uid = auth.user_id_from_header(authorization)
    return JSONResponse(store.list_sessions(limit, user_id=uid))


@app.get("/api/sessions/{session_id}")
def get_session(session_id: int, authorization: Optional[str] = Header(None)) -> JSONResponse:
    """Full stored SessionSummary for one id (scoped to the caller)."""
    uid = auth.user_id_from_header(authorization)
    record = store.get_session(session_id, user_id=uid)
    if record is None:
        return JSONResponse(status_code=404, content={"error": "session not found"})
    return JSONResponse(record)


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: int, authorization: Optional[str] = Header(None)) -> JSONResponse:
    """Remove one of the caller's sessions from history."""
    uid = auth.user_id_from_header(authorization)
    return JSONResponse({"deleted": store.delete_session(session_id, user_id=uid)})


# --------------------------------------------------------------------------- #
# Authentication — email/password, guest is purely client-side, + Google OAuth
# --------------------------------------------------------------------------- #


def _public_user(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "name": user["name"]}


@app.post("/api/auth/register")
async def auth_register(payload: dict = Body(...)) -> JSONResponse:
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    name = (payload.get("name") or (email.split("@")[0] if email else "") or "User").strip()
    if "@" not in email or "." not in email:
        return JSONResponse(status_code=422, content={"error": "a valid email is required"})
    if len(password) < 6:
        return JSONResponse(status_code=422, content={"error": "password must be at least 6 characters"})
    try:
        uid = store.create_user(email, name, password_hash=auth.hash_password(password))
    except ValueError:
        return JSONResponse(status_code=409, content={"error": "an account with that email already exists"})
    token = auth.make_token({"uid": uid, "email": email})
    return JSONResponse({"token": token, "user": {"id": uid, "email": email, "name": name}})


@app.post("/api/auth/login")
async def auth_login(payload: dict = Body(...)) -> JSONResponse:
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    user = store.get_user_by_email(email)
    if not user or not user.get("password_hash") or not auth.verify_password(password, user["password_hash"]):
        return JSONResponse(status_code=401, content={"error": "invalid email or password"})
    token = auth.make_token({"uid": user["id"], "email": user["email"]})
    return JSONResponse({"token": token, "user": _public_user(user)})


@app.get("/api/auth/me")
def auth_me(authorization: Optional[str] = Header(None)) -> JSONResponse:
    uid = auth.user_id_from_header(authorization)
    user = store.get_user_by_id(uid) if uid is not None else None
    if not user:
        return JSONResponse(status_code=401, content={"error": "not authenticated"})
    return JSONResponse({"user": _public_user(user)})


@app.get("/api/auth/google/login")
def auth_google_login() -> RedirectResponse:
    if not auth.google_configured():
        return JSONResponse(status_code=503, content={"error": "Google sign-in is not configured on the server"})
    return RedirectResponse(auth.google_login_url(auth.make_state()))


@app.get("/api/auth/google/callback")
def auth_google_callback(code: str = "", state: str = "") -> RedirectResponse:
    base = auth.FRONTEND_URL.rstrip("/") + "/login"
    if not auth.google_configured():
        return RedirectResponse(f"{base}?error=google_not_configured")
    if not code or auth.verify_token(state) is None:
        return RedirectResponse(f"{base}?error=google_failed")
    try:
        info = auth.google_exchange(code)
        user = store.upsert_google_user(info["email"], info["name"], info["sub"])
    except Exception:
        return RedirectResponse(f"{base}?error=google_failed")
    token = auth.make_token({"uid": user["id"], "email": user["email"]})
    frag = urllib.parse.urlencode({"token": token, "name": user["name"], "email": user["email"]})
    # hand the token to the SPA via URL fragment (never logged server-side)
    return RedirectResponse(f"{base}#{frag}")


# --------------------------------------------------------------------------- #
# Minimal demo page (NOT the production React UI — see README roadmap)
# --------------------------------------------------------------------------- #

_DEMO_HTML = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Smart Eye — Demo</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto,sans-serif;margin:0;background:#0f1720;color:#e6edf3}
  .wrap{max-width:760px;margin:0 auto;padding:24px}
  .mock{background:#7a1f1f;color:#fff;padding:12px 16px;border-radius:8px;font-weight:700;
        text-align:center;letter-spacing:.3px}
  .disc{background:#3a2d00;color:#ffe9a8;padding:12px 16px;border-radius:8px;margin-top:12px;
        border:1px solid #6b5400;font-size:14px}
  .card{background:#161f2b;border:1px solid #243140;border-radius:12px;padding:20px;margin-top:16px}
  label{display:block;margin:10px 0 4px;font-size:14px;color:#9fb0c0}
  input[type=range]{width:100%}
  button{margin-top:16px;background:#2f81f7;color:#fff;border:0;padding:12px 18px;
         border-radius:8px;font-weight:600;cursor:pointer}
  pre{background:#0b1119;padding:14px;border-radius:8px;overflow:auto;font-size:13px}
  .gauge{font-size:42px;font-weight:800;text-align:center}
</style></head>
<body><div class="wrap">
  <h1>Smart Eye</h1>
  <div class="mock" id="mockBanner">CHECKING MODEL…</div>
  <div class="disc">__DISCLAIMER__</div>

  <div class="card">
    <label>Anterior-segment image (optional)</label>
    <input type="file" id="img" accept="image/*"/>
    <label>Pain (1–5): <span id="vpain">1</span></label>
    <input type="range" id="pain" min="1" max="5" value="1"/>
    <label>Redness (1–5): <span id="vred">1</span></label>
    <input type="range" id="redness" min="1" max="5" value="1"/>
    <label>Photophobia (1–5): <span id="vpho">1</span></label>
    <input type="range" id="photophobia" min="1" max="5" value="1"/>
    <label>Blurred vision (1–5): <span id="vblur">1</span></label>
    <input type="range" id="blurred_vision" min="1" max="5" value="1"/>
    <label>Fatigue score (0–100): <span id="vfat">0</span></label>
    <input type="range" id="fatigue_score" min="0" max="100" value="0"/>
    <button onclick="score()">Compute Ocular Health Index</button>
  </div>

  <div class="card" id="result" style="display:none">
    <div class="gauge" id="ohi"></div>
    <div id="band" style="text-align:center;margin-bottom:8px"></div>
    <pre id="json"></pre>
  </div>

<script>
['pain','redness','photophobia','blurred_vision','fatigue_score'].forEach(id=>{
  const el=document.getElementById(id);
  const map={pain:'vpain',redness:'vred',photophobia:'vpho',blurred_vision:'vblur',fatigue_score:'vfat'};
  el.addEventListener('input',()=>document.getElementById(map[id]).textContent=el.value);
});
fetch('/api/health').then(r=>r.json()).then(h=>{
  const b=document.getElementById('mockBanner');
  if(h.is_mock){b.textContent='⚠ MOCK MODEL ACTIVE — disease output is a placeholder, NOT a screening result';}
  else{b.style.background='#1f5e2f';b.textContent='Trained model loaded: '+h.disease_model;}
});
async function score(){
  const fd=new FormData();
  const f=document.getElementById('img').files[0];
  if(f) fd.append('file',f);
  const qs=new URLSearchParams();
  ['pain','redness','photophobia','blurred_vision','fatigue_score'].forEach(id=>{
    qs.append(id,document.getElementById(id).value);
  });
  const res=await fetch('/api/session/score?'+qs.toString(),{method:'POST',body:fd});
  const data=await res.json();
  document.getElementById('result').style.display='block';
  const ohi=data.ohi;
  const colourMap={green:'#3fb950',amber:'#d29922',red:'#f85149'};
  document.getElementById('ohi').textContent='OHI '+ohi.ohi;
  document.getElementById('ohi').style.color=colourMap[ohi.colour]||'#fff';
  document.getElementById('band').textContent=ohi.band+' risk';
  document.getElementById('json').textContent=JSON.stringify(data,null,2);
}
</script>
</div></body></html>"""


# --------------------------------------------------------------------------- #
# PDF export endpoint
# --------------------------------------------------------------------------- #

@app.get("/api/sessions/{session_id}/pdf")
async def export_session_pdf(
    session_id: int,
    authorization: Optional[str] = Header(None),
) -> JSONResponse:
    """Export a session as a downloadable PDF report."""
    from fastapi.responses import FileResponse
    from starlette.background import BackgroundTask
    import os
    from ..domain.report_generator import generate_pdf

    uid = auth.user_id_from_header(authorization)
    record = store.get_session(session_id, user_id=uid)
    if record is None:
        return JSONResponse(status_code=404, content={"error": "session not found"})

    # record["payload"] is a JSON string — parse it back to dict
    import json
    try:
        payload = json.loads(record["payload"]) if isinstance(record["payload"], str) else record["payload"]
    except Exception:
        payload = record

    tmp_path = f"/tmp/smart_eye_report_{session_id}.pdf"
    try:
        generate_pdf(payload, session_id=session_id, output_path=tmp_path)
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": f"PDF generation failed: {exc}"})

    def cleanup():
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    return FileResponse(
        path=tmp_path,
        media_type="application/pdf",
        filename=f"smart_eye_report_{session_id}.pdf",
        background=BackgroundTask(cleanup),
    )
