# Smart Eye — Backend & ML Pipeline Foundation

Foundation for the COM668 Smart Eye platform, locked to the **3-class fundus**
scope (Normal / Glaucoma / Diabetic Retinopathy), single-backbone transfer
learning, **MediaPipe** landmarks, and a **FastAPI + PostgreSQL** orchestration
layer. Generated with AI assistance (Claude, Anthropic) as **engineering
scaffolding**: published algorithms, integration plumbing, mocks, schema, and
tests. The assessed core — the trained model and the fuzzy rule base — is left
for you to write, marked at every boundary.

## AI assistance acknowledgment

Keep a log (date · file · what was generated · what you changed and why) and
cite it in your declaration. Treat every file here like a library or a
supervisor's worked example: understand it line by line before your mentor
review — you will be asked to explain it, and to defend the design choices.

## Scope decision (locked this sprint)

- **Classes:** Normal / Glaucoma / Diabetic Retinopathy (fundus). Resolves the
  earlier contradiction: these have clean labels in ODIR-5K / combined Kaggle
  fundus sets, unlike the 9-class anterior list (no public dataset).
- **Backbone:** single transfer-learning backbone (MobileNetV2 or ResNet-50),
  not the 175M-param dual VGG+ResNet hybrid — correct complexity for 3 classes.
- **Landmarks:** MediaPipe (settles the dlib contradiction in your docs).
- Update your AT2/AT3 text so the report matches this. A marker comparing the
  two will notice if they diverge.

## Quickstart

    python3.10 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    pytest tests/ -v                    # foundation tests pass; sprint tests skip

    # API (uses MockScreeningModel until you train the real one):
    docker compose -f deploy/docker-compose.yml up --build
    # -> http://localhost:8000/docs  (interactive API explorer)

## Structure

    smart_eye/
      config.py                 Shared constants, OHI bands, mandated disclaimer
      domain/
        ear.py                  EAR formula + blink/closure state machine (MediaPipe)
        fuzzy_engine.py         Mamdani MFs + demo rules (27-rule base is yours)
        cnn_screening.py        Inference contract + mock (training is yours)
      persistence/
        models.py               SQLAlchemy models -> PostgreSQL (Screening Domain)
      api/
        schemas.py              Pydantic request/response contracts
        main.py                 FastAPI endpoints wiring domain -> persistence
    tests/test_smart_eye.py     T01–T05 as executable tests
    deploy/                     Dockerfile + compose (API + Postgres)
    models/                     Your exported fundus_classifier.keras goes here
    notebooks/                  Your Colab training notebook goes here

## What's provided vs. what's yours

| Provided (foundation) | Yours (assessed) |
|---|---|
| EAR formula + blink/closure bookkeeping | Live capture loop, adaptive threshold, alert dispatch, real `fatigue_score` |
| Fuzzy universes, MFs, defuzzification, 3 demo rules | The 27-rule matrix + tuning + expert validation (O3/M4) |
| Inference contract + deterministic mock | ODIR-5K label wrangling, model architecture, training, eval (O1/M2) |
| PostgreSQL schema, API endpoints, tests | WebAuthn/TOTP auth (US-001), PDF report endpoint (Sprint 5), Streamlit dashboard (Sprint 4) |

## Two things to handle deliberately

1. **ODIR-5K is multi-label** (one patient row, both eyes, multiple diagnosis
   flags). Converting to clean single-label 3-class data — and deciding what to
   do with comorbid/ambiguous cases — is your preprocessing task and a
   defensible design decision you must be able to explain.
2. **No auth ships here.** The API has no WebAuthn/TOTP yet (US-001 is its own
   deliverable). Do not expose it publicly until you add it.

## Sprint-to-code map

| Sprint | You build | Where |
|---|---|---|
| 0 | ODIR-5K download + label wrangling, env | `notebooks/`, `models/` |
| 1 | Single-backbone transfer learning, eval >=85%, export | replaces `MockScreeningModel` |
| 2 | MediaPipe capture loop -> `BlinkDetector`; alert dispatch | client capture; extend `domain/ear.py` |
| 3 | 27-rule Mamdani matrix + fatigue score + validation | `build_full_rule_base()`, `fatigue_score()` |
| 4 | Streamlit dashboard (theme from Concept B) | new `ui/` |
| 5 | Recommendations (<=2 actions) + PDF export | new module + API endpoint |
| 6 | Integration tests T04–T08, latency benchmarks, hardening | `tests/` |
| 7 | Evaluation, SUS study, AT3 | docs |

## Honest limitations

No trained model ships here (impossible to generate). The fuzzy demo rules are
intentionally too coarse to submit. Auth, the live capture loop, the dashboard,
and reporting do not exist yet. That is the project — this is the launchpad
that lets you build it in a technically sound order.
