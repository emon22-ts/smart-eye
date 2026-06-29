"""
Anterior-segment workflow tests.

Validates the second vision module and proves it reuses the shared backend:
  TA1 — mock model: all classes, sums to 1, deterministic, honest provenance.
  TA2 — preprocessing keeps pixels in [0, 255] (NOT /255) and fixes odd inputs.
  TA3 — inference latency within the IMAGE_INFERENCE_BUDGET_S budget.
  TA4 — boundary inputs flow through the SHARED fuzzy engine without NaN.
  TA5 — Grad-CAM returns a finite, normalised heatmap (epsilon-guarded).
  TA6 — the anterior model scores end-to-end through the SHARED orchestrator.
  TA7 — HTTP round-trip against the /api/anterior router (httpx).

Runs with numpy + pytest; the Grad-CAM and HTTP tests skip cleanly if their
optional deps (tensorflow, httpx) are absent.

Run:  pytest smart_eye/tests/test_anterior.py -v
"""
from __future__ import annotations

import io
import time

import numpy as np
import pytest

from smart_eye.config import ANTERIOR_CLASSES, IMAGE_INFERENCE_BUDGET_S
from smart_eye.domain.anterior_screening import (
    MockAnteriorModel,
    load_default_anterior_model,
    preprocess_image_anterior,
)
from smart_eye.domain.fuzzy_risk_engine import MamdaniFuzzyEngine
from smart_eye.orchestration.orchestrator import ScreeningOrchestrator
from smart_eye.schemas import FatigueSnapshot, SymptomScores


# --- TA1: mock model -------------------------------------------------------- #

def test_anterior_mock_returns_all_classes_summing_to_one():
    model = MockAnteriorModel()
    img = np.full((224, 224, 3), 128, dtype=np.uint8)
    pred = model.predict(img)
    assert set(pred.probabilities) == set(ANTERIOR_CLASSES)
    assert abs(sum(pred.probabilities.values()) - 1.0) < 1e-3
    assert pred.is_mock is True  # provenance must be honest


def test_anterior_mock_is_deterministic_for_same_image():
    model = MockAnteriorModel()
    img = np.full((224, 224, 3), 200, dtype=np.uint8)
    assert model.predict(img).probabilities == model.predict(img).probabilities


# --- TA2: preprocessing invariants ------------------------------------------ #

def test_anterior_preprocess_handles_grayscale_and_rgba():
    gray = np.full((64, 64), 100, dtype=np.uint8)
    rgba = np.full((64, 64, 4), 100, dtype=np.uint8)
    assert preprocess_image_anterior(gray).shape == (1, 224, 224, 3)
    assert preprocess_image_anterior(rgba).shape == (1, 224, 224, 3)


def test_anterior_preprocess_keeps_0_255_range_not_normalised():
    """EfficientNet self-normalises, so the batch must stay in [0, 255]. A
    constant-100 image must come back ~100, NOT ~0.39 (which would mean it was
    wrongly divided by 255 like the fundus path)."""
    img = np.full((64, 64, 3), 100, dtype=np.uint8)
    batch = preprocess_image_anterior(img)
    assert batch.max() > 1.5  # decisively not in [0, 1]
    assert 90.0 <= float(batch.mean()) <= 110.0
    assert batch.dtype == np.float32


# --- TA3: inference latency ------------------------------------------------- #

def test_anterior_inference_within_budget_mock():
    """Wrapper/plumbing latency through the orchestrator with the mock model is
    always far inside budget (deterministic, no GPU / weights needed)."""
    orch = ScreeningOrchestrator(disease_model=MockAnteriorModel())
    img = np.random.randint(0, 256, size=(300, 300, 3)).astype(np.uint8)
    symptoms = SymptomScores()
    fatigue = FatigueSnapshot(fatigue_score=10.0)

    n = 5
    t0 = time.perf_counter()
    for _ in range(n):
        orch.score_session(image=img, symptoms=symptoms, fatigue=fatigue)
    avg_s = (time.perf_counter() - t0) / n
    assert avg_s < IMAGE_INFERENCE_BUDGET_S


def test_anterior_inference_latency_real_model():
    """Real EfficientNetB0 single-image latency. Skips if no trained model is
    present (mock active)."""
    model = load_default_anterior_model()
    if getattr(model, "is_mock", True):
        pytest.skip("Real anterior model not loaded (mock active) — skipping latency.")
    img = np.random.randint(0, 256, size=(224, 224, 3)).astype(np.uint8)

    model.predict(img)  # warm-up (graph/layout setup)
    n = 5
    t0 = time.perf_counter()
    for _ in range(n):
        model.predict(img)
    avg_s = (time.perf_counter() - t0) / n
    print(f"\n[TA3] Avg anterior inference latency: {avg_s * 1000:.1f} ms "
          f"(budget {IMAGE_INFERENCE_BUDGET_S * 1000:.0f} ms)")
    assert avg_s < IMAGE_INFERENCE_BUDGET_S


# --- TA4: boundary safety through the SHARED fuzzy engine ------------------- #

@pytest.mark.parametrize(
    "confidence, fatigue, symptom, label",
    [
        (0.0, 0.0, 1.0, "all minima"),
        (1.0, 100.0, 5.0, "all maxima"),
        (1.0, 0.0, 1.0, "confident, rested, no symptoms"),
        (0.0, 100.0, 5.0, "unsure, exhausted, severe symptoms"),
    ],
)
def test_anterior_confidence_into_shared_fuzzy_is_finite(confidence, fatigue, symptom, label):
    """The anterior model's confidence feeds the SAME MamdaniFuzzyEngine; extreme
    values must defuzzify to a finite OHI in [0, 100]."""
    eng = MamdaniFuzzyEngine()
    res = eng.infer(confidence=confidence, fatigue=fatigue, symptom=symptom)
    assert np.isfinite(res.ohi) and 0.0 <= res.ohi <= 100.0, f"OHI bad for {label}"
    assert np.isfinite(res.risk_index) and 0.0 <= res.risk_index <= 100.0


def test_anterior_preprocess_degenerate_inputs_do_not_crash():
    for bad in (np.zeros((10, 10, 3), np.uint8),
                np.full((8, 8, 3), 255, np.uint8),
                np.full((5, 5), 0, np.uint8)):
        assert preprocess_image_anterior(bad).shape == (1, 224, 224, 3)


# --- TA5: Grad-CAM finiteness ----------------------------------------------- #

def _tiny_efficientnet_like():
    """A minimal CNN whose final activation is named 'top_activation' and whose
    input matches the anterior preprocessing size — exercises the Grad-CAM hook +
    epsilon-guarded normalisation without building the full EfficientNetB0."""
    import tensorflow as tf

    from smart_eye.config import ANTERIOR_INPUT_SIZE

    h, w = ANTERIOR_INPUT_SIZE
    inp = tf.keras.Input(shape=(h, w, 3))
    x = tf.keras.layers.Conv2D(8, 3, padding="same", name="some_conv")(inp)
    x = tf.keras.layers.Activation("relu", name="top_activation")(x)
    x = tf.keras.layers.GlobalAveragePooling2D(name="gap")(x)
    out = tf.keras.layers.Dense(len(ANTERIOR_CLASSES), activation="softmax", name="disease")(x)
    return tf.keras.Model(inp, out)


def test_anterior_gradcam_is_finite_and_normalised():
    pytest.importorskip("tensorflow")
    from smart_eye.domain.anterior_gradcam import generate_gradcam_anterior

    model = _tiny_efficientnet_like()
    image = (np.random.rand(48, 48, 3) * 255.0).astype(np.uint8)
    heatmap = generate_gradcam_anterior(model, image)

    assert heatmap.ndim == 2
    assert np.all(np.isfinite(heatmap)), "Grad-CAM produced non-finite values."
    assert heatmap.min() >= 0.0
    assert heatmap.max() <= 1.0 + 1e-6


# --- TA6: end-to-end through the SHARED orchestrator ------------------------ #

def test_anterior_orchestrator_end_to_end_produces_summary():
    orch = ScreeningOrchestrator(disease_model=MockAnteriorModel())
    img = np.full((300, 300, 3), 120, dtype=np.uint8)
    symptoms = SymptomScores(pain=2, redness=2, photophobia=1, blurred_vision=1)
    fatigue = FatigueSnapshot(fatigue_score=20.0, blink_rate_bpm=17.0)
    summary = orch.score_session(image=img, symptoms=symptoms, fatigue=fatigue)
    assert 0.0 <= summary.ohi.ohi <= 100.0
    assert summary.disease.is_mock is True
    assert summary.ohi.band in {"Low", "Moderate", "High"}
    assert set(summary.disease.probabilities) == set(ANTERIOR_CLASSES)


# --- TA7: HTTP round-trip against the anterior router ----------------------- #

def test_anterior_api_screen_image_round_trip():
    httpx = pytest.importorskip("httpx")
    import asyncio

    from fastapi import FastAPI
    from PIL import Image

    from smart_eye.orchestration.anterior_api import router

    app = FastAPI()
    app.include_router(router)

    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (120, 120, 120)).save(buf, format="PNG")
    png_bytes = buf.getvalue()

    async def _call():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.post(
                "/api/anterior/screen/image",
                files={"file": ("eye.png", png_bytes, "image/png")},
            )

    response = asyncio.run(_call())
    assert response.status_code == 200
    body = response.json()
    assert set(body["probabilities"]) == set(ANTERIOR_CLASSES)
    assert "top_class" in body and "is_mock" in body
