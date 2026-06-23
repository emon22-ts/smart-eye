"""
Core unit + integration tests.

These exercise the genuinely-real logic (EAR geometry, the fuzzy engine,
recommendation rules, the orchestration pipeline) and run with only numpy +
pytest installed. Test IDs map to the project's Test Plan (T01-T05).

Run:  pytest -q
"""
from __future__ import annotations

import numpy as np

from smart_eye.config import DISEASE_CLASSES, FATIGUE
from smart_eye.domain.disease_screening import MockDiseaseModel, preprocess_image
from smart_eye.domain.fatigue_monitor import FatigueMonitor, eye_aspect_ratio
from smart_eye.domain.fuzzy_risk_engine import MamdaniFuzzyEngine
from smart_eye.domain.recommendations import RecommendationEngine, band_from_ohi
from smart_eye.orchestration.orchestrator import ScreeningOrchestrator
from smart_eye.schemas import FatigueSnapshot, SymptomScores


# --- EAR geometry (T02) ----------------------------------------------------- #

def test_ear_open_eye_known_coordinates():
    # Constructed so EAR = (2 + 2) / (2 * 6) = 0.3333...
    eye = [(0, 0), (1, 1), (5, 1), (6, 0), (5, -1), (1, -1)]
    assert abs(eye_aspect_ratio(eye) - (4.0 / 12.0)) < 1e-6


def test_ear_closed_eye_below_threshold():
    eye = [(0, 0), (1, 0.1), (5, 0.1), (6, 0), (5, -0.1), (1, -0.1)]
    assert eye_aspect_ratio(eye) < FATIGUE.ear_threshold


def test_ear_degenerate_horizontal_returns_zero():
    eye = [(2, 0), (2, 1), (2, 1), (2, 0), (2, -1), (2, -1)]
    assert eye_aspect_ratio(eye) == 0.0


# --- Drowsiness state machine (T05) ----------------------------------------- #

def test_drowsiness_triggers_after_sustained_closure():
    mon = FatigueMonitor()
    closed_ear = 0.10  # below default 0.25 threshold
    snap = mon.update(closed_ear, timestamp=0.0)
    assert not snap.drowsy
    # Still closed 3.1s later -> alert.
    snap = mon.update(closed_ear, timestamp=3.1)
    assert snap.drowsy is True


def test_missing_landmarks_do_not_crash_or_count_blinks():
    mon = FatigueMonitor()
    snap = mon.update(None, timestamp=0.0)
    assert snap.face_detected is False
    assert mon.blink_count == 0


def test_blink_is_counted_on_quick_close_open():
    # The monitor applies a 3-frame moving average to EAR (FatigueMonitor.update) to
    # suppress single-frame landmark noise. A realistic blink must therefore (1) hold
    # closed long enough for the smoothed mean to fall below the 0.25 threshold, then
    # (2) reopen with high-EAR frames so the smoothed mean rises back above it, all
    # within max_blink_seconds (0.4s) of closure onset. Verified numerically:
    #   ts=0.12 window [0.40,0.04,0.04] mean=0.160 < 0.25  -> closed (onset ts=0.12)
    #   ts=0.20 window [0.04,0.40,0.40] mean=0.280 > 0.25  -> reopen -> blink counted
    mon = FatigueMonitor()
    mon.update(0.40, timestamp=0.00)
    mon.update(0.40, timestamp=0.04)
    mon.update(0.04, timestamp=0.08)
    mon.update(0.04, timestamp=0.12)
    mon.update(0.40, timestamp=0.16)
    mon.update(0.40, timestamp=0.20)
    assert mon.blink_count == 1


# --- Fuzzy engine (T03) ----------------------------------------------------- #

def test_fuzzy_boundaries_in_range():
    eng = MamdaniFuzzyEngine()
    for conf in (0.0, 1.0):
        for fat in (0.0, 100.0):
            for sym in (1.0, 5.0):
                res = eng.infer(conf, fat, sym)
                assert 0.0 <= res.ohi <= 100.0
                assert 0.0 <= res.risk_index <= 100.0


def test_fuzzy_healthy_inputs_give_high_ohi():
    eng = MamdaniFuzzyEngine()
    res = eng.infer(confidence=0.0, fatigue=0.0, symptom=1.0)
    assert res.ohi >= 67.0 and res.band == "Low" and res.colour == "green"


def test_fuzzy_severe_inputs_give_low_ohi():
    eng = MamdaniFuzzyEngine()
    res = eng.infer(confidence=0.95, fatigue=95.0, symptom=5.0)
    assert res.ohi < 34.0 and res.band == "High" and res.colour == "red"


def test_fuzzy_severe_symptoms_elevate_even_with_low_model_confidence():
    eng = MamdaniFuzzyEngine()
    low_sym = eng.infer(confidence=0.05, fatigue=10.0, symptom=1.0).ohi
    sev_sym = eng.infer(confidence=0.05, fatigue=10.0, symptom=5.0).ohi
    assert sev_sym < low_sym  # severe symptoms reduce health score


# --- Mock disease model (T01) ----------------------------------------------- #

def test_mock_predict_returns_all_classes_summing_to_one():
    model = MockDiseaseModel()
    img = np.full((224, 224, 3), 128, dtype=np.uint8)
    pred = model.predict(img)
    assert set(pred.probabilities) == set(DISEASE_CLASSES)
    assert abs(sum(pred.probabilities.values()) - 1.0) < 1e-3
    assert pred.is_mock is True  # provenance must be honest


def test_mock_is_deterministic_for_same_image():
    model = MockDiseaseModel()
    img = np.full((224, 224, 3), 200, dtype=np.uint8)
    a = model.predict(img).probabilities
    b = model.predict(img).probabilities
    assert a == b


def test_preprocess_handles_grayscale_and_rgba():
    gray = np.full((64, 64), 100, dtype=np.uint8)
    rgba = np.full((64, 64, 4), 100, dtype=np.uint8)
    assert preprocess_image(gray).shape == (1, 224, 224, 3)
    assert preprocess_image(rgba).shape == (1, 224, 224, 3)


# --- Recommendations -------------------------------------------------------- #

def test_recommendations_capped_at_two_and_carry_disclaimer():
    rec_engine = RecommendationEngine()
    eng = MamdaniFuzzyEngine()
    ohi = eng.infer(0.95, 95.0, 5.0)  # high risk
    model = MockDiseaseModel()
    disease = model.predict(np.full((224, 224, 3), 50, dtype=np.uint8))
    fatigue = FatigueSnapshot(fatigue_score=90.0, drowsy=True)
    rec = rec_engine.build(ohi, disease, fatigue)
    assert len(rec.actions) <= 2
    assert rec.disclaimer  # non-empty disclaimer always attached


# --- End-to-end (T04) ------------------------------------------------------- #

def test_orchestrator_end_to_end_produces_summary():
    orch = ScreeningOrchestrator()  # defaults to mock model
    img = np.full((300, 300, 3), 120, dtype=np.uint8)
    symptoms = SymptomScores(pain=2, redness=2, photophobia=1, blurred_vision=1)
    fatigue = FatigueSnapshot(fatigue_score=20.0, blink_rate_bpm=17.0)
    summary = orch.score_session(image=img, symptoms=symptoms, fatigue=fatigue)
    assert 0.0 <= summary.ohi.ohi <= 100.0
    assert summary.disease.is_mock is True
    assert summary.ohi.band in {"Low", "Moderate", "High"}
