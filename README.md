# Smart Eye — Preliminary Vision Screening Platform (engineering scaffold)

A multi-modal screening pipeline that fuses three signals — an anterior-segment
disease classifier, real-time Eye Aspect Ratio (EAR) fatigue monitoring, and a
symptom questionnaire — into a single **Ocular Health Index (OHI)** using a
Mamdani fuzzy inference system, then turns that index into plain-language
guidance.

This repository is a **runnable engineering foundation**, not a finished
clinical product. Read the scope section before doing anything else.

---

## ⚠️ Honest scope — read this first

**There is no trained, validated disease model in this repo, and one cannot be
produced without a labelled dataset and a training run.** Accordingly:

| Component | Status |
|---|---|
| EAR computation, blink + drowsiness detection | ✅ Real, runs on numpy only |
| Mamdani fuzzy engine + centroid defuzzification | ✅ Real, runs on numpy only |
| Recommendations engine | ✅ Real, deterministic |
| FastAPI orchestration + endpoints | ✅ Real, runs with FastAPI installed |
| Hybrid CNN **architecture** (ResNet-50 + VGG-16) | ✅ Real, trainable model definition |
| Trained CNN **weights** | ❌ Not included — you must train them |
| Disease predictions out of the box | ⚠️ **MOCK** placeholder, flagged `is_mock=True` |
| React clinical UI, PostgreSQL persistence, dlib webcam loop | ⛔ Not built yet (roadmap below) |

The shipped `MockDiseaseModel` returns synthetic numbers so the end-to-end
pipeline runs and can be demonstrated. **Its output is not a screening result
and must never be presented to a user as one.** The code enforces this: every
prediction carries an `is_mock` flag, the production model loudly warns and
falls back to the mock if no trained weights are found, and the demo page shows
a red "MOCK MODEL ACTIVE" banner whenever the mock is in use.

This is the right engineering posture for a portfolio/assessment piece: a
reviewer trusts honest scaffolding with a clear path to a real model far more
than a demo that fakes medical output.

> **Disclaimer (rendered in-app):** Smart Eye is a preliminary screening and
> triage support utility. It does NOT provide a clinical diagnosis. Final
> medical conclusions remain entirely the responsibility of qualified
> healthcare professionals.

---

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # or just `numpy pytest` for the core

# 1) run the tests (core needs only numpy + pytest)
pytest -q

# 2) run the API + demo page
uvicorn smart_eye.orchestration.api:app --reload
#   open http://127.0.0.1:8000
```

The core logic (EAR, fuzzy engine, recommendations, orchestrator) runs with
**numpy alone** — no TensorFlow, dlib, or FastAPI required. Those heavy
dependencies are imported lazily, so the package always loads.

---

## Architecture

```
smart_eye/
├── config.py                  # all thresholds, class names, fuzzy universes, disclaimer
├── schemas.py                 # request/response contracts (pydantic, with dataclass fallback)
├── domain/
│   ├── disease_screening.py   # interface + MockDiseaseModel + trainable hybrid CNN + Keras path
│   ├── fatigue_monitor.py     # EAR maths + blink/drowsiness state machine + dlib adapter
│   ├── fuzzy_risk_engine.py   # pure-numpy Mamdani FIS, centroid defuzzification
│   └── recommendations.py     # rule-based guidance, OHI band mapping
├── orchestration/
│   ├── orchestrator.py        # fuses the four modules into a SessionSummary (no web deps)
│   └── api.py                 # FastAPI app, endpoints, timing middleware, demo page
└── tests/
    └── test_core.py           # 15 tests mapped to the project Test Plan (T01–T05)
```

### The EAR formula

```
EAR = (‖p2 − p6‖ + ‖p3 − p5‖) / (2 · ‖p1 − p4‖)
```

Computed per eye from the six dlib landmarks (indices 36–41 left, 42–47 right),
averaged across both. A blink is a sub-400 ms close→open; a closure sustained
beyond 3.0 s raises a drowsiness event. The threshold defaults to 0.25 and can
adapt to a per-user open-eye baseline.

### OHI semantics (a deliberate choice worth knowing)

The fuzzy engine reasons about **risk** (0–100, higher = worse). The reported
**OHI is the health-framed inverse**, `OHI = 100 − risk`, so a *high* OHI means
*healthy*. This reconciles two things the source spec states but never
connects: rules phrased as "THEN Risk is High", and a score card where 82 is
green/"GOOD". Bands follow the design's state machine:

```
OHI ≥ 67  → Low risk      (green)
34–67     → Moderate risk (amber)
OHI < 34  → High risk      (red)
```

---

## Decisions where the source spec was inconsistent

The brief and the design document disagreed in a few places. Choices made:

- **UI framework:** spec says React 18 in one place, Streamlit in another. The
  backend is UI-agnostic; a minimal HTML demo page ships now, React is on the
  roadmap.
- **Database:** PostgreSQL (ERD/appendices) vs SQLite (architecture prose). The
  schemas are persistence-agnostic; no DB is wired in yet (roadmap).
- **ML framework:** TensorFlow/Keras (main spec) vs PyTorch+ONNX (appendix D).
  Followed the main spec — the trainable architecture is Keras.
- **Fuzzy library:** spec names scikit-fuzzy. The included engine is an
  equivalent pure-numpy Mamdani implementation (always runs, fully transparent,
  and shows the maths rather than hiding it behind a library call). See below to
  swap in scikit-fuzzy if your assessment requires the named library.

### Using scikit-fuzzy instead of the bundled engine

The bundled `MamdaniFuzzyEngine` uses the same membership functions, min/max
operators, and centroid defuzzification as scikit-fuzzy's `control` API. If you
need the literal library, mirror `RULES` in `fuzzy_risk_engine.py` onto
`skfuzzy.control.Rule` objects over `Antecedent`/`Consequent` universes and
swap the engine behind the same `infer()` signature — the orchestrator won't
change.

---

## Roadmap to a complete system

1. **Train the model.** `build_hybrid_cnn()` gives you the dual-branch
   ResNet-50 + VGG-16 architecture. Assemble a labelled anterior-segment
   dataset, train, and drop the weights at `smart_eye/models/hybrid_cnn.h5`.
   `KerasDiseaseModel` picks them up automatically and `is_mock` flips to false.
   (Validate honestly and report the confusion matrix — the nine classes are
   clinically serious, including tumour and glaucoma.)
2. **React clinical UI** — the live-feed-centred dashboard, OHI gauge, and PDF
   report view described in the spec. I can build this next.
3. **Webcam fatigue loop** — wire MediaPipe (browser) or dlib (server) into
   `/api/fatigue/frame`; the EAR/blink/drowsiness logic is already done.
4. **Persistence** — PostgreSQL schema + repository layer for anonymised session
   history and audit trail.

---

## Note on academic use

The source document this was built from is an academic submission carrying an
originality declaration that explicitly permits AI assistance *provided it is
acknowledged*. If you submit any of this for assessment, acknowledge the AI
contribution per your institution's policy.
