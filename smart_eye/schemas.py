"""
Data contracts exchanged across the orchestration boundary.

These use pydantic when it is installed (FastAPI needs it anyway), but fall back
to lightweight dataclasses so the domain layer and its unit tests can run with
nothing but the standard library + numpy. This keeps the core logic importable
in constrained environments while preserving typed request/response models for
the API.
"""
from __future__ import annotations

from typing import Dict, List, Optional

try:  # pragma: no cover - exercised implicitly by environment
    from pydantic import BaseModel, Field

    _HAVE_PYDANTIC = True
except Exception:  # pydantic not installed -> dataclass shim
    _HAVE_PYDANTIC = False
    from dataclasses import dataclass, field

    def Field(default=None, **_kwargs):  # type: ignore
        return default

    class BaseModel:  # minimal stand-in supporting kwargs construction + .dict()
        def __init__(self, **data):
            for k, v in data.items():
                setattr(self, k, v)

        def dict(self):
            return {k: v for k, v in self.__dict__.items()}


class SymptomScores(BaseModel):
    """1-5 Likert responses from the symptom questionnaire."""

    pain: int = Field(1)
    redness: int = Field(1)
    photophobia: int = Field(1)
    blurred_vision: int = Field(1)

    def aggregate(self) -> float:
        """Mean Likert intensity on the fuzzy symptom universe [1, 5]."""
        vals = [self.pain, self.redness, self.photophobia, self.blurred_vision]
        return sum(vals) / len(vals)


class DiseasePrediction(BaseModel):
    """Per-class probabilities plus provenance flags."""

    probabilities: Dict[str, float] = Field(default_factory=dict)
    top_class: str = Field("")
    top_confidence: float = Field(0.0)
    # CRITICAL provenance flag. True means the numbers are placeholders from the
    # mock model and must never be shown to a user as a screening result.
    is_mock: bool = Field(True)
    model_id: str = Field("mock-v0")


class FatigueSnapshot(BaseModel):
    """Aggregated fatigue state for one screening session."""

    ear: float = Field(0.0)
    blink_rate_bpm: float = Field(0.0)
    drowsy: bool = Field(False)
    fatigue_score: float = Field(0.0)  # 0-100, derived; feeds the fuzzy engine
    face_detected: bool = Field(True)


class OHIResult(BaseModel):
    """Output of the fuzzy risk engine."""

    ohi: float = Field(100.0)          # 0-100, higher = healthier
    risk_index: float = Field(0.0)     # 100 - ohi, higher = riskier
    band: str = Field("Low")           # Low | Moderate | High
    colour: str = Field("green")       # green | amber | red
    rule_activations: List[str] = Field(default_factory=list)


class Recommendation(BaseModel):
    actions: List[str] = Field(default_factory=list)  # max 2, prioritised
    urgency: str = Field("routine")
    referral_flag: bool = Field(False)
    disclaimer: str = Field("")


class SessionSummary(BaseModel):
    """Everything needed to render the score card / PDF report."""

    disease: DiseasePrediction
    fatigue: FatigueSnapshot
    symptoms_aggregate: float
    ohi: OHIResult
    recommendation: Recommendation
    latency_ms: float = Field(0.0)
