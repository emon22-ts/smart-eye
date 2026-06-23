"""
Fatigue monitoring via the Eye Aspect Ratio (Soukupova & Cech, 2016).

This module is fully real and self-contained: the EAR computation and the
blink / drowsiness state machine depend only on numpy and run identically here
and in production. The dlib 68-point detector that supplies landmark
coordinates is wrapped behind a lazily-imported adapter (LandmarkDetector) so
that the maths can be unit-tested without the (heavy) dlib + OpenCV stack
installed.

    EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
"""
from __future__ import annotations

import time
from collections import deque
from typing import Deque, Iterable, Optional, Sequence, Tuple

import numpy as np

from ..config import FATIGUE, LEFT_EYE_IDX, RIGHT_EYE_IDX, FatigueConfig
from ..schemas import FatigueSnapshot

Point = Tuple[float, float]


# --------------------------------------------------------------------------- #
# Core geometry (pure, deterministic, dependency-light)
# --------------------------------------------------------------------------- #

def eye_aspect_ratio(eye: Sequence[Point]) -> float:
    """Compute the EAR for a single eye.

    Args:
        eye: six (x, y) coordinates ordered p1..p6 — the outer corner, the two
            upper-lid points, the inner corner, and the two lower-lid points,
            matching the dlib landmark ordering in ``config.LEFT_EYE_IDX``.

    Returns:
        The eye aspect ratio. Open eyes typically sit near 0.3; a blink or
        closed eye drops the value toward 0. Returns 0.0 if the horizontal
        span is degenerate (avoids divide-by-zero on malformed input).
    """
    if len(eye) != 6:
        raise ValueError(f"EAR expects exactly 6 points, got {len(eye)}")
    p = np.asarray(eye, dtype=np.float64)
    vertical = np.linalg.norm(p[1] - p[5]) + np.linalg.norm(p[2] - p[4])
    horizontal = np.linalg.norm(p[0] - p[3])
    if horizontal <= 1e-9:
        return 0.0
    return float(vertical / (2.0 * horizontal))


def average_ear(landmarks_68: Sequence[Point]) -> float:
    """Mean EAR across both eyes given a full 68-point landmark array."""
    left = [landmarks_68[i] for i in LEFT_EYE_IDX]
    right = [landmarks_68[i] for i in RIGHT_EYE_IDX]
    return 0.5 * (eye_aspect_ratio(left) + eye_aspect_ratio(right))


# --------------------------------------------------------------------------- #
# Stateful session monitor
# --------------------------------------------------------------------------- #

class FatigueMonitor:
    """Tracks EAR over time to surface blink rate, drowsiness, and a 0-100
    fatigue score suitable as a fuzzy-engine input.

    The monitor is frame-rate agnostic: every call to :meth:`update` carries a
    timestamp, so blink durations and the rolling blinks-per-minute figure are
    computed in wall-clock time rather than frame counts.
    """

    SESSION_GAP_S = 4.0  # gap (s) longer than this between frames => new session

    def __init__(self, cfg: FatigueConfig = FATIGUE) -> None:
        self.cfg = cfg
        self._ear_history: Deque[Tuple[float, float]] = deque(maxlen=cfg.history_maxlen)
        self._blink_times: Deque[float] = deque()
        self._open_samples: Deque[float] = deque(maxlen=512)
        self._ear_smooth: Deque[float] = deque(maxlen=3)
        self._eye_closed = False
        self._closed_since: Optional[float] = None
        self._blink_started: Optional[float] = None
        self.blink_count = 0
        self.drowsy_event_active = False

    def _reset_session(self) -> None:
        """Clear per-session state when a new monitoring session begins."""
        self._ear_history.clear()
        self._blink_times.clear()
        self._open_samples.clear()
        self._ear_smooth.clear()
        self._eye_closed = False
        self._closed_since = None
        self._blink_started = None
        self.blink_count = 0
        self.drowsy_event_active = False

    # -- threshold ------------------------------------------------------------
    def _effective_threshold(self) -> float:
        if self.cfg.adaptive_threshold and len(self._open_samples) >= 30:
            baseline = float(np.median(self._open_samples))
            return max(0.10, self.cfg.adaptive_fraction * baseline)
        return self.cfg.ear_threshold

    # -- main update ----------------------------------------------------------
    def update(self, ear: Optional[float], timestamp: Optional[float] = None) -> FatigueSnapshot:
        """Advance the state machine with one EAR reading.

        Args:
            ear: the measured EAR, or ``None`` when the face/landmarks could not
                be located this frame (handled gracefully — no crash, no false
                blink, ``face_detected=False`` in the returned snapshot).
            timestamp: wall-clock seconds; defaults to ``time.monotonic()``.
        """
        now = time.monotonic() if timestamp is None else timestamp

        # A long gap since the last received frame means the camera was off
        # (or the face was absent): reset per-session state so blink history
        # and the warm-up are scoped to a single sitting.
        if self._ear_history and (now - self._ear_history[-1][0]) > self.SESSION_GAP_S:
            self._reset_session()

        if ear is None:
            # Landmark lock lost. Do not mutate blink state on missing data.
            return self._snapshot(ear=0.0, face_detected=False, now=now)

        self._ear_history.append((now, ear))
        self._ear_smooth.append(ear)
        smoothed = float(np.mean(self._ear_smooth))
        threshold = self._effective_threshold()
        is_closed = smoothed < threshold

        if is_closed and not self._eye_closed:
            # transition open -> closed
            self._eye_closed = True
            self._closed_since = now
            self._blink_started = now
        elif not is_closed and self._eye_closed:
            # transition closed -> open: was it a blink or a sustained closure?
            self._eye_closed = False
            if self._blink_started is not None:
                duration = now - self._blink_started
                if duration <= self.cfg.max_blink_seconds:
                    self.blink_count += 1
                    self._blink_times.append(now)
            self._closed_since = None
            self._blink_started = None
            self.drowsy_event_active = False
        elif not is_closed:
            # eye open this frame — contribute to the adaptive baseline
            self._open_samples.append(ear)

        drowsy = self._check_drowsiness(now)
        return self._snapshot(ear=ear, face_detected=True, now=now, drowsy=drowsy)

    # -- derived signals ------------------------------------------------------
    def _check_drowsiness(self, now: float) -> bool:
        if self._eye_closed and self._closed_since is not None:
            if now - self._closed_since >= self.cfg.drowsiness_seconds:
                self.drowsy_event_active = True
                return True
        return False

    def _blink_rate_bpm(self, now: float) -> float:
        window = self.cfg.blink_rate_window_seconds
        while self._blink_times and now - self._blink_times[0] > window:
            self._blink_times.popleft()
        if not self._blink_times:
            return 0.0
        elapsed = min(window, max(1.0, now - self._blink_times[0]))
        return len(self._blink_times) * (60.0 / elapsed)

    def _fatigue_score(self, bpm: float, drowsy: bool, observed_s: float = 0.0) -> float:
        """Map blink behaviour to a 0-100 fatigue score for the fuzzy engine.

        Healthy resting blink rate is ~15-20 bpm; both extremes signal strain.
        A low blink rate is only trusted once enough time has elapsed for blinks
        to plausibly have occurred: the low-blink penalty ramps in over the
        blink-rate window, so a fresh session does not read a false 'severe'
        merely because no blink has been recorded yet. A drowsiness event still
        floors the score at 100.
        """
        if drowsy:
            return 100.0
        healthy_low, healthy_high = 15.0, 20.0
        if healthy_low <= bpm <= healthy_high:
            deviation = 0.0
        elif bpm < healthy_low:
            raw = (healthy_low - bpm) / healthy_low
            confidence = min(1.0, observed_s / self.cfg.blink_rate_window_seconds)
            deviation = raw * confidence
        else:
            deviation = min(1.0, (bpm - healthy_high) / 40.0)
        return float(np.clip(deviation * 100.0, 0.0, 100.0))

    def _snapshot(self, ear: float, face_detected: bool, now: float,
                  drowsy: bool = False) -> FatigueSnapshot:
        bpm = self._blink_rate_bpm(now)
        observed_s = (now - self._ear_history[0][0]) if self._ear_history else 0.0
        return FatigueSnapshot(
            ear=round(ear, 4),
            blink_rate_bpm=round(bpm, 2),
            drowsy=drowsy,
            fatigue_score=round(self._fatigue_score(bpm, drowsy, observed_s), 2),
            face_detected=face_detected,
        )

    @property
    def ear_series(self) -> list:
        """Time-series history (timestamp, ear) for trend visualisation."""
        return list(self._ear_history)


# --------------------------------------------------------------------------- #
# Optional dlib/OpenCV adapter (lazy — never imported unless used)
# --------------------------------------------------------------------------- #

class LandmarkDetector:
    """Thin adapter over dlib's 68-point predictor.

    Instantiation is cheap; the heavy import and model load happen on first use.
    If dlib / OpenCV / the shape-predictor file are unavailable, :meth:`detect`
    returns ``None`` (face not found) rather than raising, so the live feed
    degrades to a 'face lost' prompt instead of crashing.
    """

    def __init__(self, predictor_path: str = "shape_predictor_68_face_landmarks.dat") -> None:
        self.predictor_path = predictor_path
        self._detector = None
        self._predictor = None
        self._init_error: Optional[str] = None

    def _ensure_loaded(self) -> bool:
        if self._predictor is not None:
            return True
        if self._init_error is not None:
            return False
        try:  # pragma: no cover - requires dlib at runtime
            import dlib  # type: ignore

            self._detector = dlib.get_frontal_face_detector()
            self._predictor = dlib.shape_predictor(self.predictor_path)
            return True
        except Exception as exc:  # missing dlib or model file
            self._init_error = str(exc)
            return False

    def detect(self, gray_frame) -> Optional[list]:
        """Return 68 (x, y) tuples for the first detected face, or None."""
        if not self._ensure_loaded():
            return None
        try:  # pragma: no cover - requires dlib at runtime
            faces = self._detector(gray_frame, 0)
            if not faces:
                return None
            shape = self._predictor(gray_frame, faces[0])
            return [(shape.part(i).x, shape.part(i).y) for i in range(68)]
        except Exception:
            return None
