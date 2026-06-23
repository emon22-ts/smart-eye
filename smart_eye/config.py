"""
Central configuration for the Smart Eye screening platform.

All tunable constants live here so that thresholds, model paths, and the
fuzzy-system universe definitions are defined in exactly one place. Nothing in
this module performs I/O or imports heavy libraries, so it is safe to import
from anywhere (including tests) with no side effects.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Tuple

# --------------------------------------------------------------------------- #
# Disease screening
# --------------------------------------------------------------------------- #

# The four FUNDUS (posterior-segment) classes from the Guna Venkat Doddi
# "Eye Diseases Classification" dataset. We pivoted away from the 9-class
# anterior-segment taxonomy (Ueno et al.) because no verifiable public training
# data existed for those classes.
#
# The ORDER of this tuple is the canonical label order used everywhere: model
# output index i maps to DISEASE_CLASSES[i]. It MUST match the `classes=`
# argument passed to flow_from_directory in train_hybrid.py, or predictions will
# be silently mislabelled. Do not reorder without retraining the model.
DISEASE_CLASSES: Tuple[str, ...] = (
    "Normal",
    "Cataract",
    "Glaucoma",
    "Diabetic_Retinopathy",
)

# Input size expected by the ResNet-50 / VGG-16 branches.
CNN_INPUT_SIZE: Tuple[int, int] = (224, 224)


# --------------------------------------------------------------------------- #
# Fatigue monitoring (Eye Aspect Ratio)
# --------------------------------------------------------------------------- #

# dlib 68-point landmark indices for the two eyes. Each tuple is ordered as the
# six EAR points p1..p6 (outer corner, top-outer, top-inner, inner corner,
# bottom-inner, bottom-outer) so that fatigue_monitor.eye_aspect_ratio can
# consume them directly.
LEFT_EYE_IDX: Tuple[int, ...] = (36, 37, 38, 39, 40, 41)
RIGHT_EYE_IDX: Tuple[int, ...] = (42, 43, 44, 45, 46, 47)


@dataclass(frozen=True)
class FatigueConfig:
    """Tunable parameters for blink/drowsiness detection."""

    # EAR below this is treated as a closed eye. Used as the *default*; the
    # FatigueMonitor can adapt it from a per-user open-eye baseline.
    ear_threshold: float = 0.25
    # Sustained closure beyond this many seconds dispatches a drowsiness alert.
    drowsiness_seconds: float = 2.5
    # A blink is counted when the eye closes then re-opens within this window.
    max_blink_seconds: float = 0.4
    # Rolling window (seconds) used to report a live blinks-per-minute figure.
    blink_rate_window_seconds: float = 60.0
    # Cap on the retained EAR time-series (protects memory on long sessions).
    history_maxlen: int = 4096
    # If True, ear_threshold is recomputed as a fraction of the running
    # open-eye median once enough samples are collected.
    adaptive_threshold: bool = True
    adaptive_fraction: float = 0.80  # closed if EAR < fraction * open_baseline


# --------------------------------------------------------------------------- #
# Performance budgets (asserted in tests / surfaced by API timing middleware)
# --------------------------------------------------------------------------- #

IMAGE_INFERENCE_BUDGET_S: float = 2.0
FRAME_PROCESSING_BUDGET_MS: float = 50.0


# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #

@dataclass(frozen=True)
class Paths:
    """Filesystem locations. Resolved relative to the package root."""

    root: Path = field(default_factory=lambda: Path(__file__).resolve().parent)

    @property
    def models_dir(self) -> Path:
        return self.root / "models"

    @property
    def disease_model_file(self) -> Path:
        # The trained weights you must supply. Absent by default -> the screening
        # module degrades to the clearly-labelled mock model (see disease_screening).
        return self.models_dir / "hybrid_cnn.h5"


PATHS = Paths()
FATIGUE = FatigueConfig()

# --------------------------------------------------------------------------- #
# Non-dismissible disclaimer (rendered at login and on every report)
# --------------------------------------------------------------------------- #

DISCLAIMER = (
    "Smart Eye is a preliminary screening and triage support utility. It does "
    "NOT provide a clinical diagnosis. Final medical conclusions remain "
    "entirely the responsibility of qualified healthcare professionals."
)
