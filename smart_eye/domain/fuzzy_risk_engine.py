"""
Fuzzy risk engine — a Mamdani inference system with centroid defuzzification.

Implemented in pure numpy so it is fully transparent and runs with no heavy
dependencies. It is mathematically equivalent to the scikit-fuzzy ``control``
API named in the project spec (triangular/trapezoidal membership functions,
min-implication, max-aggregation, centroid defuzzification); a note in the
README explains how to swap in scikit-fuzzy if a library-backed implementation
is required for assessment.

Semantics note (important): the engine reasons about *risk* (0 = no risk,
100 = maximum risk). The reported Ocular Health Index is the health-framed
inverse, ``OHI = 100 - risk``, so a HIGH OHI means HEALTHY. This matches the
state-machine bands in the design document:

    OHI >= 67  -> Low risk      (green / Normal)
    34-67      -> Moderate risk (amber / Elevated)
    OHI < 34   -> High risk     (red  / Alert)
"""
from __future__ import annotations

from typing import Callable, Dict, List, Tuple

import numpy as np

from .recommendations import band_from_ohi  # noqa: F401  (re-export convenience)
from ..schemas import OHIResult

# --------------------------------------------------------------------------- #
# Membership function primitives
# --------------------------------------------------------------------------- #

def trimf(x: float, a: float, b: float, c: float) -> float:
    """Triangular membership value of scalar ``x`` (robust at shoulders)."""
    if x < a or x > c:
        return 0.0
    if x == b:
        return 1.0
    if a <= x < b:
        return (x - a) / (b - a) if b > a else 1.0
    return (c - x) / (c - b) if c > b else 1.0


def trapmf(x: float, a: float, b: float, c: float, d: float) -> float:
    """Trapezoidal membership value of scalar ``x`` (robust at shoulders).

    Correctly returns 1.0 on the plateau ``[b, c]`` including degenerate
    left/right shoulders where ``a == b`` or ``c == d`` (e.g. a value sitting
    exactly at the left edge of a left-shoulder set has full membership).
    """
    if x < a or x > d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if a <= x < b:
        return (x - a) / (b - a) if b > a else 1.0
    return (d - x) / (d - c) if d > c else 1.0


# --------------------------------------------------------------------------- #
# Input fuzzy sets (singleton fuzzification: evaluate at the crisp input)
# --------------------------------------------------------------------------- #

# Each term is a callable mapping a crisp input to a membership degree in [0, 1].

CONFIDENCE_TERMS: Dict[str, Callable[[float], float]] = {
    "Low":    lambda x: trapmf(x, 0.0, 0.0, 0.20, 0.45),
    "Medium": lambda x: trimf(x, 0.30, 0.50, 0.70),
    "High":   lambda x: trapmf(x, 0.55, 0.80, 1.0, 1.0),
}

FATIGUE_TERMS: Dict[str, Callable[[float], float]] = {
    "Rested":   lambda x: trapmf(x, 0.0, 0.0, 20.0, 40.0),
    "Fatigued": lambda x: trimf(x, 30.0, 55.0, 75.0),
    "Severe":   lambda x: trapmf(x, 65.0, 85.0, 100.0, 100.0),
}

SYMPTOM_TERMS: Dict[str, Callable[[float], float]] = {
    "Mild":     lambda x: trapmf(x, 1.0, 1.0, 2.0, 2.5),
    "Moderate": lambda x: trimf(x, 2.0, 3.0, 4.0),
    "Severe":   lambda x: trapmf(x, 3.5, 4.5, 5.0, 5.0),
}

# --------------------------------------------------------------------------- #
# Output fuzzy sets, defined over a discretised RISK universe [0, 100]
# --------------------------------------------------------------------------- #

_RISK_UNIVERSE = np.linspace(0.0, 100.0, 1001)

RISK_TERMS: Dict[str, np.ndarray] = {
    "Low":    np.array([trapmf(u, 0.0, 0.0, 20.0, 40.0) for u in _RISK_UNIVERSE]),
    "Medium": np.array([trimf(u, 30.0, 50.0, 70.0) for u in _RISK_UNIVERSE]),
    "High":   np.array([trapmf(u, 60.0, 80.0, 100.0, 100.0) for u in _RISK_UNIVERSE]),
}

# --------------------------------------------------------------------------- #
# Rule base
# --------------------------------------------------------------------------- #
# Each rule = (antecedents, operator, consequent_risk_term, label).
# An antecedent is (input_name, term_name). ``operator`` is "AND" (min) or
# "OR" (max) applied across that rule's antecedents.
#
# This curated set captures the clinically important intersections — notably
# that a confident model finding OR severe symptoms always elevate risk, and
# that severe symptoms elevate even when the model is unsure. It can be expanded
# to the full 3x3x3 = 27-rule factorial without changing the engine.

Antecedent = Tuple[str, str]
Rule = Tuple[List[Antecedent], str, str, str]

RULES: List[Rule] = [
    ([("confidence", "High"), ("symptom", "Severe")], "OR", "High",
     "R1: model High OR symptoms Severe -> High risk"),
    ([("confidence", "Medium"), ("symptom", "Moderate")], "AND", "Medium",
     "R2: model Medium AND symptoms Moderate -> Medium risk"),
    ([("confidence", "Low"), ("symptom", "Mild"), ("fatigue", "Rested")], "AND", "Low",
     "R3: model Low AND symptoms Mild AND Rested -> Low risk"),
    ([("fatigue", "Severe")], "AND", "Medium",
     "R4: Severe fatigue -> Medium risk"),
    ([("confidence", "High"), ("fatigue", "Severe")], "AND", "High",
     "R5: model High AND Severe fatigue -> High risk"),
    ([("confidence", "Low"), ("symptom", "Moderate")], "AND", "Medium",
     "R6: model Low AND symptoms Moderate -> Medium risk"),
    ([("symptom", "Severe"), ("fatigue", "Severe")], "AND", "High",
     "R7: symptoms Severe AND Severe fatigue -> High risk"),
    ([("confidence", "Low"), ("symptom", "Severe")], "AND", "Medium",
     "R8: model Low AND symptoms Severe -> Medium risk (caution despite low model conf.)"),
    ([("confidence", "High"), ("symptom", "Mild")], "AND", "Medium",
     "R9: model High AND symptoms Mild -> Medium risk (flag for review)"),
    ([("confidence", "Medium"), ("fatigue", "Rested"), ("symptom", "Mild")], "AND", "Low",
     "R10: model Medium AND Rested AND symptoms Mild -> Low risk"),
]

_TERM_SETS = {
    "confidence": CONFIDENCE_TERMS,
    "fatigue": FATIGUE_TERMS,
    "symptom": SYMPTOM_TERMS,
}


class MamdaniFuzzyEngine:
    """Fuses CNN confidence, fatigue score, and symptom intensity into an OHI."""

    def __init__(self, rules: List[Rule] = RULES) -> None:
        self.rules = rules

    def _firing_strength(self, rule: Rule, inputs: Dict[str, float]) -> float:
        antecedents, operator, _consequent, _label = rule
        degrees = []
        for input_name, term_name in antecedents:
            value = inputs[input_name]
            degrees.append(_TERM_SETS[input_name][term_name](value))
        if not degrees:
            return 0.0
        return min(degrees) if operator == "AND" else max(degrees)

    def infer(self, confidence: float, fatigue: float, symptom: float) -> OHIResult:
        """Run inference.

        Args:
            confidence: max CNN class confidence in [0, 1].
            fatigue: fatigue score in [0, 100].
            symptom: aggregated Likert intensity in [1, 5].
        """
        confidence = float(np.clip(confidence, 0.0, 1.0))
        fatigue = float(np.clip(fatigue, 0.0, 100.0))
        symptom = float(np.clip(symptom, 1.0, 5.0))
        inputs = {"confidence": confidence, "fatigue": fatigue, "symptom": symptom}

        aggregate = np.zeros_like(_RISK_UNIVERSE)
        activations: List[str] = []
        for rule in self.rules:
            strength = self._firing_strength(rule, inputs)
            if strength <= 1e-6:
                continue
            consequent = rule[2]
            clipped = np.minimum(strength, RISK_TERMS[consequent])  # Mamdani min-implication
            aggregate = np.maximum(aggregate, clipped)              # max-aggregation
            activations.append(f"{rule[3]} (μ={strength:.2f})")

        denom = aggregate.sum()
        if denom <= 1e-9:
            risk = 50.0  # no rule fired -> neutral prior
        else:
            risk = float((_RISK_UNIVERSE * aggregate).sum() / denom)  # centroid

        ohi = round(100.0 - risk, 2)
        band, colour = band_from_ohi(ohi)
        return OHIResult(
            ohi=ohi,
            risk_index=round(risk, 2),
            band=band,
            colour=colour,
            rule_activations=activations,
        )
