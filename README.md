# Smart Eye — Clinical Intelligence Platform

> **Preliminary screening and triage support utility.**
> Smart Eye does NOT provide a clinical diagnosis. Final medical conclusions remain entirely the responsibility of qualified healthcare professionals.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack](#4-technology-stack)
5. [Repository Structure](#5-repository-structure)
6. [Setup & Installation](#6-setup--installation)
7. [Running the Application](#7-running-the-application)
8. [Model Training](#8-model-training)
9. [API Reference](#9-api-reference)
10. [Test Suite](#10-test-suite)
11. [Design Decisions & Limitations](#11-design-decisions--limitations)
12. [Performance Benchmarks](#12-performance-benchmarks)

---

## 1. Project Overview

Smart Eye is a full-stack, privacy-first ocular health screening platform built as a university capstone project. It combines three independent AI/computational pipelines into a single composite risk score called the **Ocular Health Index (OHI)**:

| Pipeline | Technology | Purpose |
|---|---|---|
| Fundus disease screening | ResNet-50 + VGG-16 hybrid CNN | Classify retinal images into 4 disease classes |
| Anterior-segment screening | EfficientNetB0 | Classify corneal/anterior images into 4 classes |
| Real-time fatigue monitoring | dlib 68-point landmarks + Eye Aspect Ratio (EAR) | Detect drowsiness and blink rate from webcam |

These three signals are fused by a **Mamdani fuzzy inference system** (pure NumPy, no external fuzzy library) to produce the OHI. A deterministic recommendation engine then maps the OHI band to plain-language clinical guidance, capped at two actions to prevent alert fatigue.

The platform is accessible via a React/Vite frontend (port 5174) backed by a FastAPI REST API (port 8000), with SQLite session persistence and optional Google OAuth authentication.

---

## 2. Key Features

- **Dual vision workflows** — fundus (posterior-segment) and anterior-segment classifiers run as independent, parallel pipelines sharing the same orchestration, fuzzy engine, persistence, and PDF export layer.
- **Grad-CAM explainability** — both CNNs produce a jet-coloured heatmap overlay showing which image regions drove the prediction, returned as a base64 PNG data URI alongside the prediction JSON.
- **Mamdani fuzzy risk fusion** — confidence, fatigue score, and symptom intensity are fused using triangular/trapezoidal membership functions, min-implication, max-aggregation, and centroid defuzzification — all implemented transparently in NumPy.
- **Real-time fatigue monitor** — EAR computed from 68 facial landmarks at ~8 Hz; blink detection uses a 3-frame smoothed EAR with adaptive threshold; drowsiness triggers after 2.5 s of sustained closure.
- **Privacy-first design** — raw video never leaves the device; only landmark coordinates are sent to the API.
- **Mock-model fallback** — if no trained weights are present, a clearly-labelled deterministic mock model activates. The UI shows a loud "MOCK MODEL" banner so screening output can never be mistaken for a real result.
- **Stratified K-Fold training** — the anterior trainer uses 5-fold cross-validation with per-fold balanced class weights (scikit-learn), giving an honest mean validation accuracy across imbalanced clinical data.
- **Session history & PDF export** — signed-in users get persistent session history and downloadable PDF reports; guests see only their live result.
- **Bilingual UI** — full English/Bengali (বাংলা) internationalisation via a custom i18n hook.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React / Vite Frontend                │
│              localhost:5174  (port 5174)                │
│   Home · Screening · Fatigue · History · Analytics     │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTP / REST (Vite proxy → :8000)
┌──────────────────────▼──────────────────────────────────┐
│               FastAPI Orchestration Layer               │
│                    localhost:8000                       │
│  /api/*  (fundus)    │    /api/anterior/*  (anterior)   │
└──────┬───────────────┴──────────┬──────────────────────┘
       │                          │
┌──────▼──────────┐    ┌──────────▼──────────┐
│  Fundus Domain  │    │  Anterior Domain    │
│  ResNet50+VGG16 │    │  EfficientNetB0     │
│  Grad-CAM       │    │  Grad-CAM           │
└──────┬──────────┘    └──────────┬──────────┘
       │                          │
       └──────────┬───────────────┘
                  │  DiseasePrediction (shared schema)
       ┌──────────▼────────────────┐
       │  ScreeningOrchestrator    │
       │  MamdaniFuzzyEngine       │  ← pure NumPy
       │  RecommendationEngine     │
       └──────────┬────────────────┘
                  │  SessionSummary
       ┌──────────▼────────────────┐
       │  SQLite Persistence       │
       │  PDF Report Generator     │
       │  Auth (email + Google)    │
       └───────────────────────────┘
```

### Data flow (one screening session)

1. User uploads a fundus or anterior image and fills in a symptom questionnaire (1–5 Likert scale).
2. Simultaneously, the fatigue monitor accumulates per-frame EAR values from the webcam.
3. The API decodes the image, runs `model.predict(image)` → `DiseasePrediction`.
4. The orchestrator calls `fuzzy.infer(confidence, fatigue_score, symptom_aggregate)` → `OHIResult`.
5. The recommendation engine maps `(ohi_band, top_class, fatigue)` → `Recommendation` (≤ 2 actions).
6. A `SessionSummary` is returned to the frontend and optionally persisted for signed-in users.

---

## 4. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Language | Python | 3.9.6 |
| Deep learning | TensorFlow / Keras | 2.13.0 / 2.13.1 |
| API framework | FastAPI | 0.100.0 |
| Data validation | Pydantic | 1.10.26 (v1) |
| ASGI server | Uvicorn | 0.29.0 |
| Numerical compute | NumPy | 1.24.3 |
| Image processing | Pillow | 11.3.0 |
| K-fold / class weights | scikit-learn | ≥ 1.3, < 1.4 |
| HTTP client (tests) | httpx | 0.28.1 |
| Frontend | React + Vite | 18 / 4 |
| Persistence | SQLite (stdlib) | — |
| Auth | email/password + Google OAuth | — |

---

## 5. Repository Structure

```
smart_eye_project 2/
├── smart_eye/                        # Python package (backend)
│   ├── config.py                     # All constants: classes, input sizes, budgets, paths
│   ├── schemas.py                    # Pydantic data contracts (shared across layers)
│   ├── auth.py                       # Email/password + Google OAuth
│   ├── domain/
│   │   ├── disease_screening.py      # Fundus CNN: ResNet50 + VGG16 hybrid
│   │   ├── anterior_screening.py     # Anterior CNN: EfficientNetB0
│   │   ├── gradcam.py                # Grad-CAM for the fundus hybrid
│   │   ├── anterior_gradcam.py       # Grad-CAM for the anterior EfficientNetB0
│   │   ├── fuzzy_risk_engine.py      # Mamdani fuzzy inference (pure NumPy)
│   │   ├── fatigue_monitor.py        # EAR + blink/drowsiness state machine
│   │   ├── recommendations.py        # Deterministic recommendation engine
│   │   └── report_generator.py       # PDF session report
│   ├── orchestration/
│   │   ├── api.py                    # FastAPI app (fundus routes)
│   │   ├── anterior_api.py           # FastAPI router (/api/anterior/* routes)
│   │   └── orchestrator.py           # ScreeningOrchestrator (model-agnostic)
│   ├── persistence/
│   │   └── store.py                  # SQLite session CRUD
│   ├── models/                       # Trained weights (not committed to git)
│   │   ├── hybrid_cnn_native.h5      # Fundus model weights
│   │   └── anterior_efficientnet.h5  # Anterior model weights
│   └── tests/
│       ├── test_core.py              # Unit + integration tests (T01–T07)
│       ├── test_performance.py       # Latency budget tests (T08)
│       └── test_anterior.py          # Anterior workflow tests (TA1–TA7)
├── frontend/                         # React / Vite SPA
│   └── src/
│       ├── pages/                    # Home, Screening, Fatigue, History, Analytics
│       └── components.jsx            # Shared UI components
├── dataset/                          # Fundus training images (not committed)
│   ├── train/
│   └── validation/
├── dataset_anterior/                 # Anterior training images (not committed)
│   ├── train/
│   └── validation/
├── train_hybrid.py                   # Fundus model training script
├── train_anterior.py                 # Anterior model training script (K-fold)
├── requirements.txt                  # Python dependencies
└── README.md                         # This file
```

---

## 6. Setup & Installation

### Prerequisites

- Python 3.9.x (system or user install — no virtual environment required, though one is recommended)
- Node.js ≥ 18 and npm
- macOS / Linux (tested on macOS arm64)

### 1. Clone the repository

```bash
git clone https://github.com/emon22-ts/smart-eye.git
cd "smart_eye_project 2"
```

### 2. Install Python dependencies

```bash
pip install fastapi==0.100.0 uvicorn==0.29.0 python-multipart==0.0.20 \
            pillow numpy tensorflow==2.13.0 pydantic==1.10.26 httpx \
            "scikit-learn>=1.3,<1.4"
```

Or from the requirements file:

```bash
pip install -r requirements.txt
```

### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 4. Obtain trained model weights

The model weights are stored in Git LFS and are not bundled in the repository zip. After cloning, pull them with:

```bash
git lfs pull
```

This downloads `smart_eye/models/hybrid_cnn_native.h5` (fundus) and `smart_eye/models/anterior_efficientnet.h5` (anterior) into place. If LFS is unavailable, train from scratch using the scripts in [Section 8](#8-model-training).

---

## 7. Running the Application

Open two terminals from the project root.

**Terminal 1 — Backend API (port 8000):**

```bash
uvicorn smart_eye.orchestration.api:app --reload
```

On startup you will see either:
- `Loaded REAL native model from .../hybrid_cnn_native.h5` — trained model active.
- `No native model found; using MOCK MODEL.` — mock fallback active; the UI will show a warning banner.

**Terminal 2 — Frontend dev server (port 5174):**

```bash
cd frontend
npm run dev
```

Open `http://localhost:5174` in your browser.

The Vite dev server proxies all `/api` requests to `http://localhost:8000`, so no CORS configuration is needed during development.

**API-only demo page** (no frontend required):

```
http://localhost:8000
```

---

## 8. Model Training

### Fundus model (ResNet-50 + VGG-16 hybrid)

Dataset: [Guna Venkat Doddi "Eye Diseases Classification"](https://www.kaggle.com/datasets/gunavenkatdoddi/eye-diseases-classification) — 4 classes: Normal, Cataract, Glaucoma, Diabetic\_Retinopathy.

Arrange images as:

```
dataset/
  train/
    Normal/  Cataract/  Glaucoma/  Diabetic_Retinopathy/
  validation/
    Normal/  Cataract/  Glaucoma/  Diabetic_Retinopathy/
```

Then run:

```bash
python train_hybrid.py
```

This trains for up to 25 epochs with early stopping (patience 6), saves the best checkpoint to `smart_eye/models/hybrid_cnn.h5`, and prints a per-class classification report if scikit-learn is available. Achieved validation accuracy: **88.3%**.

### Anterior-segment model (EfficientNetB0)

Classes: Normal, Cataract, Keratitis, Corneal\_Scar.

Arrange images as:

```
dataset_anterior/
  train/
    Normal/  Cataract/  Keratitis/  Corneal_Scar/
  validation/   ← optional held-out check
    Normal/  Cataract/  Keratitis/  Corneal_Scar/
```

Then run:

```bash
pip install "scikit-learn>=1.3,<1.4"   # required for K-fold + class weights
python train_anterior.py
```

This performs **5-fold stratified cross-validation** with per-fold balanced class weights, an optional backbone fine-tuning phase (unfreezing all layers except BatchNorm at 1e-5 LR), and saves the best model across all folds to `smart_eye/models/anterior_efficientnet.h5`.

Key design differences from the fundus trainer:

| | Fundus | Anterior |
|---|---|---|
| Architecture | ResNet-50 + VGG-16 (late fusion) | EfficientNetB0 (single branch) |
| Pixel scaling | `rescale=1./255` | None — EfficientNet self-normalises in [0, 255] |
| Validation strategy | Single train/val split | Stratified 5-fold CV |
| Class imbalance | None applied | Balanced class weights per fold |
| Grad-CAM target layer | `conv5_block3_out` (ResNet branch) | `top_activation` (top-level) |

> **Important:** The `[0, 255]` pixel range in the anterior pipeline is intentional and load-bearing. Do not add a `/255` rescale — accuracy will silently collapse at inference time.

---

## 9. API Reference

All endpoints are served at `http://localhost:8000`. Interactive docs are available at `http://localhost:8000/docs` (Swagger UI).

### Fundus workflow

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server status, active model ID, budget constants |
| `POST` | `/api/screen/image` | Classify a fundus image → `DiseasePrediction` |
| `POST` | `/api/screen/image/explain` | Classify + return Grad-CAM overlay (base64 PNG) |
| `POST` | `/api/fatigue/frame` | Advance fatigue monitor with 68 facial landmarks |
| `POST` | `/api/session/score` | Full fusion: image + symptoms + fatigue → `SessionSummary` |
| `GET` | `/api/sessions` | List session history (signed-in users only) |
| `GET` | `/api/sessions/{id}` | Retrieve one session |
| `DELETE` | `/api/sessions/{id}` | Delete one session |
| `GET` | `/api/sessions/{id}/pdf` | Download PDF report |

### Anterior-segment workflow

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/anterior/health` | Anterior model status and class list |
| `POST` | `/api/anterior/screen/image` | Classify an anterior image → `DiseasePrediction` |
| `POST` | `/api/anterior/screen/image/explain` | Classify + Grad-CAM overlay |
| `POST` | `/api/anterior/session/score` | Full fusion (anterior model, shared fuzzy/recommender) |

### Key response schemas

**`DiseasePrediction`**
```json
{
  "probabilities": { "Normal": 0.87, "Cataract": 0.08, "Glaucoma": 0.03, "Diabetic_Retinopathy": 0.02 },
  "top_class": "Normal",
  "top_confidence": 0.87,
  "is_mock": false,
  "model_id": "hybrid-cnn-native"
}
```

**`SessionSummary`** (from `/api/session/score`)
```json
{
  "disease": { "...DiseasePrediction..." },
  "fatigue": { "ear": 0.31, "blink_rate_bpm": 16.2, "drowsy": false, "fatigue_score": 12.0, "face_detected": true },
  "symptoms_aggregate": 1.5,
  "ohi": { "ohi": 84.0, "risk_index": 16.0, "band": "Low", "colour": "green", "rule_activations": ["..."] },
  "recommendation": { "actions": ["No urgent action indicated. Continue routine eye care."], "urgency": "routine", "referral_flag": false, "disclaimer": "..." },
  "latency_ms": 78.4
}
```

### Authentication

Endpoints that persist or retrieve session data require an `Authorization` header:

```
Authorization: Bearer <token>
```

Guest users (no header) receive live results but no saved history.

---

## 10. Test Suite

Tests are written with pytest and live in `smart_eye/tests/`. Run all tests from the project root:

```bash
pytest -v
```

Run only the anterior tests:

```bash
pytest smart_eye/tests/test_anterior.py -v
```

### Test coverage

| ID | File | What it tests |
|---|---|---|
| T01 | `test_core.py` | Mock disease model: all classes, sums to 1, deterministic, `is_mock` honest |
| T02 | `test_core.py` | EAR geometry: known coordinates, closed-eye threshold, degenerate horizontal |
| T03 | `test_core.py` | Fuzzy engine: boundary OHI in [0, 100], healthy inputs → Low band, severe → High band |
| T04 | `test_core.py` | Orchestrator end-to-end: `SessionSummary` produced with correct band and mock flag |
| T05 | `test_core.py` | Drowsiness state machine: triggers after 2.5 s, face-lost handled, blink counted |
| T06 | `test_core.py` | Recommendations: capped at 2 actions, disclaimer always attached |
| T07 | `test_core.py` | Preprocessing: grayscale/RGBA coercion, output shape `(1, 224, 224, 3)` |
| T08 | `test_performance.py` | Inference latency < 2.0 s; frame processing < 50 ms (skips if mock) |
| TA1 | `test_anterior.py` | Anterior mock: 4 classes, sums to 1, deterministic, `is_mock` honest |
| TA2 | `test_anterior.py` | Anterior preprocessing: `[0, 255]` range kept (not divided by 255) |
| TA3 | `test_anterior.py` | Anterior inference latency within budget (mock + real model paths) |
| TA4 | `test_anterior.py` | Extreme fuzzy inputs produce finite OHI; degenerate images don't crash |
| TA5 | `test_anterior.py` | Grad-CAM: finite, normalised heatmap; epsilon guard prevents NaN |
| TA6 | `test_anterior.py` | Anterior model flows through the SHARED orchestrator + fuzzy engine |
| TA7 | `test_anterior.py` | HTTP round-trip against `/api/anterior/screen/image` via httpx ASGI transport |

> TA5 and TA7 require `tensorflow` and `httpx` respectively; they `pytest.skip` cleanly if those packages are absent.

---

## 11. Design Decisions & Limitations

### Why two separate vision workflows?

The fundus (posterior-segment) and anterior-segment taxonomies use different training datasets, different backbones, and — critically — different pixel scaling conventions. Merging them into one model would silently break one of the two inference paths. Running them as independent routers sharing the same orchestrator and fuzzy engine gives full isolation with no code duplication in the business logic.

### Why pure-NumPy fuzzy inference?

scikit-fuzzy's `control` API is well-known but is a black box from an assessment perspective. Implementing Mamdani inference manually in NumPy makes every membership function, rule firing, implication, aggregation, and defuzzification step directly inspectable and testable — which is important for a project that is assessed for technical depth.

### Why Stratified K-Fold for the anterior trainer?

The anterior dataset is smaller and potentially more imbalanced than the fundus dataset. A single train/val split risks a lucky or unlucky partition; 5-fold stratified CV provides an honest mean ± std accuracy that is more defensible in an assessment context.

### Known limitations

- The `is_mock` flag must always be checked before displaying predictions. The mock model is deterministic and hash-seeded but carries no clinical meaning.
- Grad-CAM is an approximation for the fundus hybrid (single-branch explanation of a fused model); it is exact for the single-branch EfficientNetB0.
- The platform is a **triage support tool**, not a diagnostic device. It has not been validated in a clinical setting.
- Real-time fatigue monitoring requires a webcam and a browser that supports the MediaDevices API.

---

## 12. Performance Benchmarks

Measured on Apple Silicon (M-series), macOS arm64, Python 3.9.6, TensorFlow 2.13.

| Metric | Value | Budget |
|---|---|---|
| Fundus CNN validation accuracy | 88.3% | ≥ 85% |
| Anterior CNN mean val accuracy (5-fold) | ≥ 88% (data-dependent) | ≥ 88% |
| Single-image inference latency | ~80 ms | < 2000 ms |
| Fatigue frame processing latency | < 1 ms | < 50 ms |
| Landmark cadence (webcam) | ~8 Hz | — |
| Fuzzy inference (NumPy centroid) | < 5 ms | — |

---

## Disclaimer

Smart Eye is a preliminary screening and triage support utility. It does NOT provide a clinical diagnosis. Final medical conclusions remain entirely the responsibility of qualified healthcare professionals.

---

## Datasets

### Fundus model (posterior-segment)
- **Dataset:** Eye Diseases Classification — Guna Venkat Doddi
- **Source:** https://www.kaggle.com/datasets/gunavenkatdoddi/eye-diseases-classification
- **Classes:** Normal, Cataract, Glaucoma, Diabetic\_Retinopathy (~1,000 images per class, 4,217 total)
- **Place images in:** `dataset/train/<class>/` and `dataset/validation/<class>/`

### Anterior-segment model
- **Dataset:** Assembled from publicly available slit-lamp and anterior segment image sources
- **Classes:** Normal, Cataract, Keratitis, Corneal\_Scar
- **Place images in:** `dataset_anterior/train/<class>/` and `dataset_anterior/validation/<class>/`

> **Note:** Datasets are not included in this repository due to size. Download them separately and place them in the correct folders before running the training scripts.
