// Landing page — full Concept C hero + feature grid. CTAs route into the app.
import React from "react";
import { useNavigate } from "react-router-dom";
import { IrisVisual } from "../components";
import { useT } from "../i18n";

const FEATURES = [
  { tk: "home.c1.t", dk: "home.c1.d", path: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" },
  { tk: "home.c2.t", dk: "home.c2.d", path: "M3 12h4l2 5 4-12 2 7h6" },
  { tk: "home.c3.t", dk: "home.c3.d", path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2" },
  { tk: "home.c4.t", dk: "home.c4.d", path: "M4 7h16 M4 12h16 M4 17h10" },
  { tk: "home.c5.t", dk: "home.c5.d", path: "M4 4h16v16H4Z M4 9h16 M9 21V9" },
  { tk: "home.c6.t", dk: "home.c6.d", path: "M12 3l8 4v6c0 5-4 7-8 8-4-1-8-3-8-8V7Z" },
];

export default function Home() {
  const nav = useNavigate();
  const { t } = useT();
  return (
    <main className="se-wrap page home">
      <header className="hero hero-home">
        <div className="hero-copy">
          <span className="pill hero-pill"><span className="dot dot-cyan" />{t("home.badge")} · v2.4</span>
          <h1 className="hero-h">SMART <span className="eye-grad">EYE</span></h1>
          <p className="hero-sub">{t("home.tagline")}</p>
          <p className="hero-desc">
            {t("home.intro")}
          </p>
          <div className="hero-btns">
            <button className="btn btn-primary btn-lg" onClick={() => nav("/screening")}>{t("home.startBtn")} →</button>
            <button className="btn btn-ghost btn-lg" onClick={() => nav("/fatigue")}>{t("home.fatigueBtn")}</button>
          </div>
          <div className="trust">
            <span>{t("home.feat1")}</span>
            <span>{t("home.feat2")}</span>
            <span>{t("home.feat3")}</span>
            <span>{t("home.feat4")}</span>
          </div>
        </div>
        <div className="hero-visual"><IrisVisual /></div>
      </header>

      <section className="features">
        <span className="eyebrow">{t("home.plat.eyebrow")}</span>
        <h2 className="h2">{t("home.plat.title")}</h2>
        <p className="lead">{t("home.plat.lead")}</p>
        <div className="feat-grid">
          {FEATURES.map((f) => (
            <div className="fcard" key={f.tk}>
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" stroke="#60A5FA" strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.path} />
                </svg>
              </div>
              <h3>{t(f.tk)}</h3>
              <p>{t(f.dk)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
