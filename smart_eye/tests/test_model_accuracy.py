"""
Model accuracy tests (T06).

Runs the REAL trained CNN over a sample of the validation set and reports overall
accuracy plus per-class precision / recall / F1. Thresholds are set to the model's
genuinely-achieved performance (~0.70 accuracy) so the suite is an honest regression
guard, not an aspirational target. Skips automatically if the real model or the
validation data is unavailable (e.g. CI without the 154MB weights).

Run:  pytest smart_eye/tests/test_model_accuracy.py -v -s
"""
from __future__ import annotations

import glob
import os
from collections import defaultdict

import numpy as np
import pytest
from PIL import Image

from smart_eye.config import DISEASE_CLASSES
from smart_eye.domain.disease_screening import load_default_model

VAL_DIR = "dataset/validation"
SAMPLES_PER_CLASS = 25          # keep the CPU run fast but statistically meaningful
MIN_OVERALL_ACCURACY = 0.55     # honest floor; the model achieves ~0.70+
MIN_MACRO_F1 = 0.50


def _load_samples():
    """Return (images, true_labels) sampled evenly across the validation classes."""
    images, labels = [], []
    for cls in DISEASE_CLASSES:
        paths = sorted(
            glob.glob(os.path.join(VAL_DIR, cls, "*.jpg"))
            + glob.glob(os.path.join(VAL_DIR, cls, "*.png"))
            + glob.glob(os.path.join(VAL_DIR, cls, "*.jpeg"))
        )[:SAMPLES_PER_CLASS]
        for p in paths:
            images.append(np.asarray(Image.open(p).convert("RGB")))
            labels.append(cls)
    return images, labels


@pytest.fixture(scope="module")
def model():
    m = load_default_model()
    if getattr(m, "is_mock", True):
        pytest.skip("Real CNN not loaded (mock active) — skipping accuracy test.")
    return m


@pytest.fixture(scope="module")
def predictions(model):
    images, labels = _load_samples()
    if not images:
        pytest.skip(f"No validation images found under {VAL_DIR}/ — skipping.")
    preds = []
    for img in images:
        result = model.predict(img)
        preds.append(result.top_class)
    return labels, preds


def test_overall_accuracy(predictions):
    labels, preds = predictions
    correct = sum(1 for t, p in zip(labels, preds) if t == p)
    acc = correct / len(labels)
    print(f"\n[T06] Overall accuracy: {acc:.3f} on {len(labels)} validation images")
    assert acc >= MIN_OVERALL_ACCURACY, f"accuracy {acc:.3f} < floor {MIN_OVERALL_ACCURACY}"


def test_per_class_f1(predictions):
    labels, preds = predictions
    tp = defaultdict(int); fp = defaultdict(int); fn = defaultdict(int)
    for t, p in zip(labels, preds):
        if t == p:
            tp[t] += 1
        else:
            fp[p] += 1
            fn[t] += 1

    print("\n[T06] Per-class metrics:")
    f1s = []
    for cls in DISEASE_CLASSES:
        prec = tp[cls] / (tp[cls] + fp[cls]) if (tp[cls] + fp[cls]) else 0.0
        rec = tp[cls] / (tp[cls] + fn[cls]) if (tp[cls] + fn[cls]) else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
        f1s.append(f1)
        print(f"  {cls:22s} precision={prec:.2f} recall={rec:.2f} f1={f1:.2f}")

    macro_f1 = sum(f1s) / len(f1s)
    print(f"  {'MACRO F1':22s} {macro_f1:.3f}")
    assert macro_f1 >= MIN_MACRO_F1, f"macro-F1 {macro_f1:.3f} < floor {MIN_MACRO_F1}"
