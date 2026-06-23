# Smart Eye — Preliminary Vision-Screening Platform

Smart Eye is a multi-modal preliminary vision-screening and triage-support web application. It fuses three independent signals — a fundus-image disease classifier, real-time webcam fatigue/drowsiness monitoring, and a symptom questionnaire — into a single **Ocular Health Index (OHI, 0–100)** via a Mamdani fuzzy-inference engine, and returns rule-based triage recommendations with an explainable Grad-CAM visualisation.

> **Disclaimer:** Smart Eye is a *preliminary screening and triage-support utility*. It does **not** provide a clinical diagnosis. Final medical conclusions remain entirely the responsibility of qualified healthcare professionals.

---

## Features

| Capability | Description |
|---|---|
| **Fundus disease screening** | Hybrid dual-branch CNN (ResNet-50 + VGG-16) classifying four classes: Normal, Cataract, Glaucoma, Diabetic Retinopathy. |
| **Grad-CAM explainability** | Heatmap overlay showing which retinal regions drove each prediction. |
| **Real-time fatigue monitor** | In-browser webcam eye-aspect-ratio (EAR) tracking via MediaPipe Face Mesh (468 landmarks), with blink-rate analysis and drowsiness alerts. Only landmark coordinates leave the browser — the video never does. |
| **Ocular Health Index** | A single 0–100 score fusing CNN confidence, fatigue, and symptom burden through a transparent Mamdani fuzzy engine. |
| **Triage recommendations** | Rule-based next-step guidance derived from the OHI band. |
| **Session history + PDF export** | Every screening is persisted locally; sessions are reviewable, trend-charted, CSV-exportable, and downloadable as a PDF report. |
| **Mobile responsive** | Adaptive layout with a hamburger navigation menu on small screens. |
| **Privacy-first** | Face detection runs on-device; no cloud image storage. |

---

## Measured performance

| Metric | Result |
|---|---|
| CNN validation accuracy | **66%** (100-image validation sample, 25/class) |
| Per-class F1 | Cataract 0.79 · Diabetic Retinopathy 0.70 · Normal 0.66 · Glaucoma 0.43 |
| Image inference latency | **~79 ms** (budget 2000 ms) |
| Fatigue-frame processing | **~0.03 ms** (budget 50 ms) |
| Automated test suite | **22 tests passing** (core logic, model accuracy, performance, API/PDF) |

---

## Tech stack

- **Backend:** Python 3.9, FastAPI, TensorFlow 2.13, NumPy, fpdf2
- **Frontend:** React 18, Vite, MediaPipe Face Mesh
- **ML:** Hybrid ResNet-50 + VGG-16 CNN; Mamdani fuzzy-inference engine; Grad-CAM
- **Persistence:** SQLite
- **Testing:** pytest, httpx

---

## Setup

### 1. Clone (with models)

The trained models are stored via **Git LFS**. Install Git LFS first, then clone:

```bash
git lfs install
git clone https://github.com/emon22-ts/smart-eye.git
cd smart-eye
git lfs pull
```

The working model is `smart_eye/models/hybrid_cnn_native.h5`.

### 2. Backend

```bash
pip install -r requirements.txt
python3 -m uvicorn smart_eye.orchestration.api:app --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in a Chromium-based browser (the fatigue monitor requires webcam access).

### 4. Run the tests

```bash
python3 -m pytest smart_eye/tests/ -v
```

---

## Dataset

The fundus dataset is **not included** in this repository. The four-class structure expected by `train_hybrid.py` is:Use `split_dataset.py` to produce the train/validation split from a source dataset.

---

## Known limitations

- **Glaucoma recall (0.32)** is the weakest class — glaucoma's optic-disc signs are subtle on fundus images, so the system should not be relied on to *rule out* glaucoma. This reinforces the preliminary-screening (not diagnostic) framing.
- **Fatigue detection** is sensitive to camera elevation: a webcam mounted below eye level compresses the vertical EAR signal. Eye-level placement is recommended.
- **Grad-CAM** visualises the ResNet-50 branch's attention; as a dual-branch fusion model, this is an approximate (single-branch) explanation.

---

*Final-year project — Ulster University.*