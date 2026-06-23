// Landing page — full Concept C hero + feature grid. CTAs route into the app.
import React from "react";
import { useNavigate } from "react-router-dom";
import { IrisVisual } from "../components";

const FEATURES = [
  {
    title: "Fundus disease screening",
    desc: "CNN classification across four fundus classes (Normal, Cataract, Glaucoma, Diabetic Retinopathy) with calibrated confidence.",
    path: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  },
  {
    title: "Real-time fatigue monitoring",
    desc: "In-browser webcam EAR tracking, blink-rate analysis and drowsiness detection with a live landmark overlay.",
    path: "M3 12h4l2 5 4-12 2 7h6",
  },
  {
    title: "Ocular Health Index",
    desc: "A single 0–100 score fusing CNN confidence, fatigue and symptom burden through a transparent fuzzy engine.",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2",
  },
  {
    title: "Transparent fuzzy logic",
    desc: "A Mamdani inference system maps the three inputs to risk — every rule activation is inspectable, not a black box.",
    path: "M4 7h16 M4 12h16 M4 17h10",
  },
  {
    title: "Session history & audit",
    desc: "Every screening is persisted locally with its scores and timestamp, so results are reviewable and reproducible.",
    path: "M4 4h16v16H4Z M4 9h16 M9 21V9",
  },
  {
    title: "Privacy-first by design",
    desc: "Face detection runs on-device; only landmark coordinates leave the browser. No cloud image storage.",
    path: "M12 3l8 4v6c0 5-4 7-8 8-4-1-8-3-8-8V7Z",
  },
];

export default function Home() {
  const nav = useNavigate();
  return (
    <main className="se-wrap page home">
      <header className="hero hero-home">
        <div className="hero-copy">
          <span className="pill hero-pill"><span className="dot dot-cyan" />Preliminary screening workflow · v2.4</span>
          <h1 className="hero-h">SMART <span className="eye-grad">EYE</span></h1>
          <p className="hero-sub">AI-Powered Preliminary Vision Screening Platform</p>
          <p className="hero-desc">
            Screen fundus conditions, monitor visual fatigue in real time, and generate explainable ocular
            health assessments using computer vision, fuzzy intelligence, and privacy-first on-device processing.
          </p>
          <div className="hero-btns">
            <button className="btn btn-primary btn-lg" onClick={() => nav("/screening")}>Start Screening →</button>
            <button className="btn btn-ghost btn-lg" onClick={() => nav("/fatigue")}>Live Fatigue Monitor</button>
          </div>
          <div className="trust">
            <span>AI-Assisted Screening</span>
            <span>Real-Time Fatigue Monitoring</span>
            <span>Explainable Results</span>
            <span>GDPR-Compliant Local Processing</span>
          </div>
        </div>
        <div className="hero-visual"><IrisVisual /></div>
      </header>

      <section className="features">
        <span className="eyebrow">The Platform</span>
        <h2 className="h2">A complete preliminary screening pipeline</h2>
        <p className="lead">From fundus classification to fuzzy-logic risk synthesis — every stage is transparent, reproducible, and runs locally on-device.</p>
        <div className="feat-grid">
          {FEATURES.map((f) => (
            <div className="fcard" key={f.title}>
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" stroke="#60A5FA" strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.path} />
                </svg>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
