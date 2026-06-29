# Smart Eye — Preliminary Ocular Health Screening Platform

![CI](https://github.com/emon22-ts/smart-eye/actions/workflows/ci.yml/badge.svg)

> **COM668 Final Year Project · Ulster University · 2025–2026**  
> Mahfuzur Rahman Emon · B00976168

Smart Eye is a privacy-first, multi-modal ocular health screening web platform. It fuses deep learning image classification, real-time webcam fatigue monitoring, and a Mamdani fuzzy inference engine to generate an explainable **Ocular Health Index (OHI)** — processed locally on-device with no cloud image storage.

---

## Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Real Performance Metrics](#real-performance-metrics)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Getting Started](#getting-started)
7. [Running the Backend](#running-the-backend)
8. [Running the Frontend](#running-the-frontend)
9. [Running Tests](#running-tests)
10. [API Reference](#api-reference)
11. [Authentication](#authentication)
12. [CI/CD Pipeline](#cicd-pipeline)
13. [Clinical Disclaimer](#clinical-disclaimer)

---

## Overview

Smart Eye runs as a **three-stage screening pipeline**:

1. **Image upload** → EfficientNetB0 CNN classifies across 4 disease categories and generates a Grad-CAM explainability heatmap
2. **Live webcam** → dlib 68-point landmark tracking computes Eye Aspect Ratio (EAR) at ~8 Hz to detect drowsiness and blink compliance
3. **Symptom questionnaire** → structured Likert-scale survey (1–5) captures subjective symptom burden

All three signals feed a **decoupled Mamdani fuzzy inference engine** producing two independent indices:

- **PRI (Pathology Risk Index, 0–100)** — driven by CNN confidence + symptom burden only
- **SRI (Screening Reliability Index, 0–100)** — driven by eye fatigue + blink compliance only

High pathology risk triggers `IMMEDIATE_CLINICAL_PRIORITY` regardless of fatigue — fatigue can never suppress a genuine pathology alert. This is enforced structurally, not by a rule patch.

---

## Key Features

| Category | Feature |
|---|---|
| **Vision AI** | EfficientNetB0 transfer learning · Grad-CAM explainability · 4-class classification |
| **Fatigue Monitor** | Real-time EAR tracking · drowsiness detection · blink compliance · ~8 Hz |
| **Fuzzy Engine** | Decoupled Mamdani PRI + SRI · Centroid defuzzification · NaN-safe boundaries |
| **Auth** | Email/password · Google OAuth (when configured) · Guest mode · JWT |
| **History** | Per-user session storage · search & filter · CSV export · trend charts · comparison |
| **Reports** | Clinical PDF — OHI gauge, Grad-CAM, risk band, recommendations |
| **Analytics** | OHI trend line · risk distribution · screening frequency heatmap |
| **i18n** | Full English / Bengali (বাংলা) — all UI text, labels, errors |
| **Accessibility** | High-contrast mode · reduced-motion guard · keyboard navigation · ARIA labels |
| **Theming** | Dark (default) + Light mode — CSS custom-property theming throughout |
| **Privacy** | On-device processing · no cloud image storage · GDPR-compliant local SQLite |

---

## Real Performance Metrics

> These are **measured values** from the trained model — not targets.

| Metric | Value |
|---|---|
| CNN validation accuracy | **66%** |
| Macro F1-score | **0.643** |
| F1 — Cataract | **0.79** |
| F1 — Diabetic Retinopathy | **0.70** |
| F1 — Normal | **0.66** |
| F1 — Glaucoma | **0.43** |
| Image inference time | **~80 ms** (CPU) |
| Fatigue frame processing | **~0.03 ms** per frame |
| Landmark detection rate | **~8 Hz** (120 ms interval) |
| Backend test suite | **35 passed** |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.9.6 · FastAPI · Uvicorn |
| **ML / Vision** | TensorFlow 2.13 · EfficientNetB0 · OpenCV · dlib |
| **Fuzzy Engine** | scikit-fuzzy · NumPy · SciPy |
| **PDF Reports** | fpdf2 2.8.4 · Pillow |
| **Database** | SQLite (local · no cloud) |
| **Frontend** | React 18 · Vite · Vanilla CSS |
| **Testing** | Pytest · httpx · pytest-asyncio |
| **CI/CD** | GitHub Actions |

---

## Project Structure
smart_eye_project/

├── .github/workflows/ci.yml   # GitHub Actions CI

├── smart_eye/

│   ├── orchestration/

│   │   ├── api.py             # FastAPI app + all routes

│   │   └── anterior_api.py    # /api/anterior/* router

│   ├── domain/

│   │   ├── screening.py       # CNN + Grad-CAM

│   │   ├── anterior_screening.py

│   │   ├── fatigue_monitor.py # EAR + blink tracking

│   │   ├── fuzzy_engine.py    # Decoupled PRI/SRI

│   │   ├── recommendations.py

│   │   └── report_generator.py

│   ├── persistence/store.py   # SQLite

│   ├── tests/

│   │   ├── test_auth_and_pdf.py

│   │   └── test_anterior.py

│   ├── schemas.py

│   └── config.py

├── frontend/src/

│   ├── pages/                 # Home, Screening, Fatigue, History...

│   ├── components.jsx

│   ├── auth.jsx

│   ├── i18n.jsx               # EN / বাংলা

│   ├── styles.js              # Dark + Light CSS

│   └── api.js

├── train_anterior.py

├── requirements.txt

├── README.md

└── ARCHITECTURE.html          # Interactive architecture diagram

---

## Getting Started

```bash
# Clone
git clone https://github.com/emon22-ts/smart-eye.git
cd smart-eye

# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install
```

---

## Running the Backend

```bash
python3 -m uvicorn smart_eye.orchestration.api:app --reload --port 8000
```

```bash
curl http://localhost:8000/api/health
# {"status":"ok","model":"live","google_auth_configured":false}
```

---

## Running the Frontend

```bash
cd frontend && npm run dev
# → http://localhost:5173
```

> The backend must be running on port 8000 first.

---

## Running Tests

```bash
python3 -m pytest smart_eye/tests/ -q       # 35 passed
python3 -m pytest smart_eye/tests/test_anterior.py -v
python3 smart_eye/domain/fuzzy_engine.py    # decoupling proof
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health + model status |
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Sign in → JWT |
| `GET` | `/api/auth/me` | Validate token |
| `POST` | `/api/session/score` | Fuse image + fatigue + symptoms → OHI |
| `POST` | `/api/screen/image/explain` | Grad-CAM heatmap |
| `POST` | `/api/fatigue/frame` | Process frame → EAR snapshot |
| `GET` | `/api/sessions` | List session history |
| `DELETE` | `/api/sessions/{id}` | Delete session |
| `GET` | `/api/sessions/{id}/pdf` | Download clinical PDF |
| `POST` | `/api/anterior/screen/image` | Anterior-segment classifier |

---

## Authentication

- **Email/Password** — JWT in `localStorage`, sent as `Authorization: Bearer <token>`
- **Google OAuth** — requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars
- **Guest mode** — full screening access, no account needed, sessions not saved to personal history

---

## CI/CD Pipeline

Every push to `main` triggers three parallel GitHub Actions jobs:

| Job | What it checks |
|---|---|
| **Backend Tests** | `pytest smart_eye/tests/ -q` |
| **Frontend Build** | `npm run build` — production Vite bundle |
| **Python Lint** | `flake8` — syntax errors and undefined names |

Live: **https://github.com/emon22-ts/smart-eye/actions**

---

## Clinical Disclaimer

Smart Eye is a **preliminary screening utility** developed as a BSc final year project. It does **not** provide clinical diagnoses, replace professional ophthalmological examination, or constitute medical advice. Users with visual symptoms should consult a qualified healthcare professional.

---

## License

Submitted in partial fulfilment of BSc (Hons) requirements at Ulster University. © 2026 Mahfuzur Rahman Emon.
