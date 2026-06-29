"""
AI Recommendations engine — deterministic, rule-based plain-language guidance.

Translates the numeric OHI band (plus the top disease class and fatigue state)
into at most two prioritised, plain-language actions. Capping at two actions is
deliberate: it prevents the alert fatigue that erodes trust in screening tools.
Nothing here is generative; identical inputs always yield identical output,
which keeps the guidance auditable.
"""
from __future__ import annotations

from typing import Tuple

from ..config import DISCLAIMER
from ..schemas import DiseasePrediction, FatigueSnapshot, OHIResult, Recommendation


def band_from_ohi(ohi: float) -> Tuple[str, str]:
    """Map a 0-100 OHI to a (band, colour) pair. Higher OHI = healthier."""
    if ohi >= 67.0:
        return "Low", "green"
    if ohi >= 34.0:
        return "Moderate", "amber"
    return "High", "red"


# Conditions for which a confident model finding warrants faster review.
# Glaucoma and diabetic retinopathy are progressive and sight-threatening;
# cataract is significant but routinely treatable, so it is not escalated here.
_URGENT_CLASSES = {
    "Glaucoma",
    "Diabetic_Retinopathy",
    # Anterior-segment additions (sight-threatening / warrant specialist review):
    "Keratitis",
    "Corneal_Scar",
}


class RecommendationEngine:
    """Builds prioritised guidance from a scored session."""

    def build(
        self,
        ohi: OHIResult,
        disease: DiseasePrediction,
        fatigue: FatigueSnapshot,
    ) -> Recommendation:
        actions: list[str] = []
        urgency = "routine"
        referral = False

        # 1) Primary action keyed off the composite risk band.
        if ohi.band == "High":
            urgency, referral = "urgent", True
            if disease.top_class in _URGENT_CLASSES and not disease.is_mock:
                actions.append("Seek specialist ophthalmology review within 48 hours.")
            else:
                actions.append("Arrange an in-person eye examination within one week.")
        elif ohi.band == "Moderate":
            urgency, referral = "soon", True
            actions.append("Book a routine optician appointment within four weeks.")
        else:
            actions.append("No urgent action indicated. Continue routine eye care.")

        # 2) At most one secondary action — fatigue first, else self-monitoring.
        if fatigue.drowsy or fatigue.fatigue_score >= 65.0:
            actions.append(
                "Rest your eyes and take regular screen breaks; re-screen when rested."
            )
        elif ohi.band != "Low":
            actions.append(
                "Re-screen in good lighting to confirm this reading before acting."
            )

        return Recommendation(
            actions=actions[:2],          # hard cap to avoid alert fatigue
            urgency=urgency,
            referral_flag=referral,
            disclaimer=DISCLAIMER,
        )
