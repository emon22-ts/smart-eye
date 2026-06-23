"""
Performance tests (T08).

Measures (a) single-image CNN inference latency and (b) fatigue-frame processing
time, comparing each against the budgets declared in config. Latency is reported so
the real numbers can be quoted in the evaluation (objective O2). Inference test
skips if the real model is unavailable.

Run:  pytest smart_eye/tests/test_performance.py -v -s
"""
from __future__ import annotations

import glob
import time

import numpy as np
import pytest
from PIL import Image

from smart_eye.config import (
    FRAME_PROCESSING_BUDGET_MS,
    IMAGE_INFERENCE_BUDGET_S,
)
from smart_eye.domain.disease_screening import load_default_model
from smart_eye.domain.fatigue_monitor import FatigueMonitor, eye_aspect_ratio


def _a_validation_image():
    for pat in ("dataset/validation/*/*.jpg", "dataset/validation/*/*.png"):
        hits = sorted(glob.glob(pat))
        if hits:
            return np.asarray(Image.open(hits[0]).convert("RGB"))
    return None


def test_image_inference_latency():
    model = load_default_model()
    if getattr(model, "is_mock", True):
        pytest.skip("Real CNN not loaded (mock active) — skipping inference latency.")
    img = _a_validation_image()
    if img is None:
        pytest.skip("No validation image available — skipping inference latency.")

    # Warm-up (first call includes graph/layout setup; not representative).
    model.predict(img)

    n = 5
    t0 = time.perf_counter()
    for _ in range(n):
        model.predict(img)
    avg_s = (time.perf_counter() - t0) / n
    print(f"\n[T08] Avg image inference latency: {avg_s * 1000:.1f} ms "
          f"(budget {IMAGE_INFERENCE_BUDGET_S * 1000:.0f} ms)")
    assert avg_s < IMAGE_INFERENCE_BUDGET_S, (
        f"inference {avg_s:.3f}s exceeds budget {IMAGE_INFERENCE_BUDGET_S}s"
    )


def test_fatigue_frame_processing_latency():
    """The per-frame EAR + monitor update must be well within the real-time budget."""
    mon = FatigueMonitor()
    # A representative open-eye landmark set (6 points), EAR ~0.3.
    eye = [(0, 0), (1, 1), (5, 1), (6, 0), (5, -1), (1, -1)]

    n = 1000
    t0 = time.perf_counter()
    for i in range(n):
        ear = eye_aspect_ratio(eye)
        mon.update(ear, timestamp=i * 0.033)
    avg_ms = (time.perf_counter() - t0) / n * 1000.0
    print(f"\n[T08] Avg fatigue-frame processing: {avg_ms:.4f} ms "
          f"(budget {FRAME_PROCESSING_BUDGET_MS:.0f} ms)")
    assert avg_ms < FRAME_PROCESSING_BUDGET_MS, (
        f"frame processing {avg_ms:.3f}ms exceeds budget {FRAME_PROCESSING_BUDGET_MS}ms"
    )
