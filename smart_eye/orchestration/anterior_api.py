"""
Anterior-segment workflow — FastAPI router.

A self-contained ``APIRouter`` mounted by ``api.py`` (one ``include_router``
line). It exposes the anterior-segment EfficientNetB0 workflow under the
``/api/anterior`` prefix, deliberately mirroring the fundus endpoints so the
frontend can call either workflow with the same request/response shapes.

Everything heavy is SHARED with the fundus pipeline:
  * the same ``ScreeningOrchestrator`` (constructed here with the anterior model),
  * the same ``MamdaniFuzzyEngine`` (the orchestrator's default),
  * the same persistence store and auth, so anterior sessions appear in the
    unified history and PDF export exactly like fundus sessions.

Only the vision model and its Grad-CAM hook differ.
"""
from __future__ import annotations

import io
import os
from typing import Optional

import numpy as np
from fastapi import APIRouter, File, Header, UploadFile
from fastapi.responses import JSONResponse

from .. import auth
from ..config import ANTERIOR_CLASSES
from ..domain.anterior_gradcam import explain_anterior_image
from ..domain.anterior_screening import load_default_anterior_model
from ..persistence import store
from ..schemas import FatigueSnapshot, SymptomScores
from .orchestrator import ScreeningOrchestrator

router = APIRouter(prefix="/api/anterior", tags=["anterior-segment"])

# Independent anterior model + its own orchestrator (sharing the fuzzy engine and
# recommender defaults). Emits a startup warning if running on the mock fallback.
_ANTERIOR_MODEL = load_default_anterior_model()
_ANTERIOR_ORCH = ScreeningOrchestrator(disease_model=_ANTERIOR_MODEL)


def _decode_image(raw: bytes) -> np.ndarray:
    """Decode uploaded bytes to an RGB array (Pillow). Local copy to keep this
    router free of any import cycle with api.py."""
    from PIL import Image

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.asarray(img)


@router.get("/health")
def anterior_health() -> dict:
    """Status of the anterior workflow and its model provenance."""
    return {
        "status": "ok",
        "workflow": "anterior-segment",
        "anterior_model": _ANTERIOR_MODEL.model_id,
        "is_mock": _ANTERIOR_MODEL.is_mock,
        "classes": list(ANTERIOR_CLASSES),
    }


@router.post("/screen/image")
async def anterior_screen_image(file: UploadFile = File(...)) -> JSONResponse:
    """Classify one uploaded anterior-segment image (mock unless a model is loaded)."""
    raw = await file.read()
    try:
        image = _decode_image(raw)
    except Exception as exc:
        return JSONResponse(status_code=422, content={"error": f"could not decode image: {exc}"})
    prediction = _ANTERIOR_MODEL.predict(image)
    return JSONResponse(prediction.dict())


@router.post("/screen/image/explain")
async def anterior_screen_image_explain(
    file: UploadFile = File(...), class_name: Optional[str] = None
) -> JSONResponse:
    """Classify an image AND return an EfficientNet Grad-CAM overlay (base64 PNG
    data URI). The overlay is null if the mock model is active or on error."""
    raw = await file.read()
    try:
        image = _decode_image(raw)
    except Exception as exc:
        return JSONResponse(status_code=422, content={"error": f"could not decode image: {exc}"})

    prediction = _ANTERIOR_MODEL.predict(image)
    out = prediction.dict()

    class_idx = None
    explained_class = None
    if class_name and class_name in ANTERIOR_CLASSES:
        class_idx = list(ANTERIOR_CLASSES).index(class_name)
        explained_class = class_name
    try:
        out["gradcam"] = explain_anterior_image(_ANTERIOR_MODEL, np.asarray(image), class_idx)
        out["gradcam_class"] = explained_class or out.get("top_class")
    except Exception:
        out["gradcam"] = None
        out["gradcam_class"] = None
    return JSONResponse(out)


@router.post("/session/score")
async def anterior_session_score(
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
    """Fuse anterior image + symptoms + fatigue into the composite OHI and
    recommendation, using the SAME fuzzy engine and orchestrator as the fundus
    workflow. Persists for signed-in users so sessions share one history."""
    image = None
    raw = b""
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
    summary = _ANTERIOR_ORCH.score_session(image=image, symptoms=symptoms, fatigue=fatigue)

    payload = summary.dict()
    for key in ("disease", "fatigue", "ohi", "recommendation"):
        obj = payload.get(key)
        if hasattr(obj, "dict"):
            payload[key] = obj.dict()
    payload["workflow"] = "anterior-segment"  # tag the workflow (store ignores extras)

    payload["session_id"] = None
    uid = auth.user_id_from_header(authorization)
    if uid is not None:
        try:
            payload["session_id"] = store.save_session(payload, user_id=uid)
        except Exception:
            payload["session_id"] = None  # never let a storage hiccup fail the screening
    try:
        _sid = payload.get("session_id")
        if _sid is not None and file is not None and raw:
            _d = os.path.join(os.path.dirname(__file__), "..", "persistence", "session_images")
            os.makedirs(_d, exist_ok=True)
            with open(os.path.join(_d, f"{_sid}.png"), "wb") as _f:
                _f.write(raw)
    except Exception:
        pass

    return JSONResponse(payload)
