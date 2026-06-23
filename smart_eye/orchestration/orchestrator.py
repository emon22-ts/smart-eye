"""
Orchestration layer — the central pipeline coordinator.

The orchestrator owns the screening session: it runs disease inference,
computes the fuzzy OHI from the three modalities, generates recommendations,
and assembles a single :class:`SessionSummary`. It holds no framework
dependencies (no FastAPI here) so it can be unit-tested and reused from a CLI,
a notebook, or the API.
"""
from __future__ import annotations

import time
from typing import Optional

import numpy as np

from ..domain.disease_screening import DiseaseScreeningModel, MockDiseaseModel
from ..domain.fuzzy_risk_engine import MamdaniFuzzyEngine
from ..domain.recommendations import RecommendationEngine
from ..schemas import (
    DiseasePrediction,
    FatigueSnapshot,
    OHIResult,
    SessionSummary,
    SymptomScores,
)


class ScreeningOrchestrator:
    """Coordinates the four domain modules to score one screening session."""

    def __init__(
        self,
        disease_model: Optional[DiseaseScreeningModel] = None,
        fuzzy_engine: Optional[MamdaniFuzzyEngine] = None,
        recommender: Optional[RecommendationEngine] = None,
    ) -> None:
        # Default to the mock model so the system is runnable out of the box.
        self.disease_model = disease_model or MockDiseaseModel()
        self.fuzzy = fuzzy_engine or MamdaniFuzzyEngine()
        self.recommender = recommender or RecommendationEngine()

    def score_session(
        self,
        image: Optional[np.ndarray],
        symptoms: SymptomScores,
        fatigue: FatigueSnapshot,
    ) -> SessionSummary:
        """Fuse image + symptoms + fatigue into a composite result.

        Args:
            image: a decoded HxWxC array, or None to skip disease screening
                (e.g. a fatigue-only session). When None, disease confidence is
                treated as 0 for the fuzzy fusion.
        """
        t0 = time.perf_counter()

        if image is not None:
            disease = self.disease_model.predict(image)
            confidence = disease.top_confidence
        else:
            disease = DiseasePrediction(
                probabilities={}, top_class="", top_confidence=0.0,
                is_mock=True, model_id="skipped",
            )
            confidence = 0.0

        symptom_agg = symptoms.aggregate()
        ohi: OHIResult = self.fuzzy.infer(
            confidence=confidence,
            fatigue=fatigue.fatigue_score,
            symptom=symptom_agg,
        )
        recommendation = self.recommender.build(ohi, disease, fatigue)

        latency_ms = (time.perf_counter() - t0) * 1000.0
        return SessionSummary(
            disease=disease,
            fatigue=fatigue,
            symptoms_aggregate=round(symptom_agg, 3),
            ohi=ohi,
            recommendation=recommendation,
            latency_ms=round(latency_ms, 2),
        )
