// Landing page — animated hero + stats band + feature grid.
// Copy runs through i18n (EN/BN); stats use the project's real measured figures.
// Motion: the iris SVG uses the existing .se-iris-* animation classes, the hero
// staggers in, and the stat numbers count up — all disabled under reduced-motion.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../i18n";

const FEATURES = [
  { tk: "home.c1.t", dk: "home.c1.d", path: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" },
  { tk: "home.c2.t", dk: "home.c2.d", path: "M3 12h4l2 5 4-12 2 7h6" },
  { tk: "home.c3.t", dk: "home.c3.d", path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2" },
  { tk: "home.c4.t", dk: "home.c4.d", path: "M4 7h16 M4 12h16 M4 17h10" },
  { tk: "home.c5.t", dk: "home.c5.d", path: "M4 4h16v16H4Z M4 9h16 M9 21V9" },
  { tk: "home.c6.t", dk: "home.c6.d", path: "M12 3l8 4v6c0 5-4 7-8 8-4-1-8-3-8-8V7Z" },
];

// Real measured figures: CNN val accuracy 66%, 4 classes, ~8Hz landmark cadence
// (120ms frame interval), ~80ms image inference.
const STATS = [
  { num: 66, pre: "", unit: "%", key: "home.stat1" },
  { num: 4, pre: "", unit: "", key: "home.stat2" },
  { num: 8, pre: "", unit: "Hz", key: "home.stat3" },
  { num: 80, pre: "~", unit: "ms", key: "home.stat4" },
];

const TRUST = ["home.feat1", "home.feat2", "home.feat3", "home.feat4"];

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const handler = () => setReduce(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", handler) : mq.addListener(handler);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", handler) : mq.removeListener(handler); };
  }, []);
  return reduce;
}

// Count from 0 to target (easeOutCubic) after an optional start delay.
function useCountUp(target, { duration = 1100, delay = 350, enabled = true } = {}) {
  const [val, setVal] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) { setVal(target); return undefined; }
    let raf, startTs, timer;
    const tick = (ts) => {
      if (startTs == null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else setVal(target);
    };
    timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, delay);
    return () => { clearTimeout(timer); if (raf) cancelAnimationFrame(raf); };
  }, [target, duration, delay, enabled]);
  return val;
}

function StatTile({ stat, animate }) {
  const { t } = useT();
  const n = useCountUp(stat.num, { enabled: animate });
  return (
    <div className="v2-stat">
      <div className="v2-stat-val">
        {stat.pre}{Math.round(n)}<span className="v2-stat-unit">{stat.unit}</span>
      </div>
      <div className="v2-stat-lbl">{t(stat.key)}</div>
    </div>
  );
}

// SVG iris wired to the existing .se-iris-* animation classes.
function IrisCard() {
  return (
    <div className="v2-iris-card" aria-hidden="true">
      <svg className="v2-iris-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="v2IrisBg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0a0f1c" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="v2IrisRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <clipPath id="v2IrisClip">
            <circle cx="110" cy="110" r="72" />
          </clipPath>
        </defs>
        {/* rotating dashed ring */}
        <circle className="se-iris-ring" cx="110" cy="110" r="105" fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="1" strokeDasharray="6 4" />
        <circle cx="110" cy="110" r="88" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
        {/* iris fill + stroke */}
        <circle cx="110" cy="110" r="72" fill="url(#v2IrisBg)" />
        <circle cx="110" cy="110" r="72" fill="none" stroke="url(#v2IrisRing)" strokeWidth="2" />
        {/* texture spokes (slow counter-rotation) */}
        <g className="se-iris-ring" style={{ animationDirection: "reverse", animationDuration: "70s" }} opacity="0.22" stroke="#60A5FA" strokeWidth="1">
          <line x1="110" y1="38" x2="110" y2="58" />
          <line x1="110" y1="162" x2="110" y2="182" />
          <line x1="38" y1="110" x2="58" y2="110" />
          <line x1="162" y1="110" x2="182" y2="110" />
          <line x1="58" y1="58" x2="72" y2="72" />
          <line x1="148" y1="148" x2="162" y2="162" />
          <line x1="162" y1="58" x2="148" y2="72" />
          <line x1="58" y1="162" x2="72" y2="148" />
        </g>
        {/* pupil */}
        <circle cx="110" cy="110" r="30" fill="#020617" />
        <circle cx="110" cy="110" r="30" fill="none" stroke="rgba(34,211,238,0.5)" strokeWidth="1.5" />
        {/* highlight */}
        <circle cx="120" cy="100" r="7" fill="rgba(255,255,255,0.1)" />
        <circle cx="117" cy="97" r="3" fill="rgba(255,255,255,0.3)" />
        {/* sweeping scan line */}
        <line className="se-iris-scan" x1="38" y1="110" x2="182" y2="110" stroke="rgba(34,211,238,0.45)" strokeWidth="1.5" clipPath="url(#v2IrisClip)" />
        {/* orbiting dot */}
        <g className="se-iris-orbit">
          <circle cx="110" cy="22" r="4" fill="#06B6D4" opacity="0.9" />
        </g>
        <text className="se-iris-text" x="110" y="207" textAnchor="middle" fontSize="9.5" fontFamily="'JetBrains Mono',monospace" fill="rgba(148,163,184,0.7)" letterSpacing="3">SCANNING</text>
      </svg>

      <div className="v2-met-row">
        <div className="v2-met">
          <span className="v2-met-lbl">OHI</span>
          <span className="v2-met-val">84</span>
        </div>
        <div className="v2-met">
          <span className="v2-met-lbl">Risk</span>
          <span className="v2-met-val" style={{ color: "#22C55E" }}>Low</span>
        </div>
        <div className="v2-met">
          <span className="v2-met-lbl">EAR</span>
          <span className="v2-met-val" style={{ color: "#D97706" }}>0.31</span>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const nav = useNavigate();
  const { t } = useT();
  const reduce = usePrefersReducedMotion();

  return (
    <main className="se-wrap page home">

      {/* HERO */}
      <header className="v2-hero">
        <div className="v2-hero-copy">
          <div className="v2-eyebrow">
            <span className="v2-eyebrow-dot" />
            {t("home.badge")} · v2.4
          </div>

          <h1 className="v2-hero-h">
            {t("home.heroPre")}<span className="v2-accent-shimmer">{t("home.heroAccent")}</span>{t("home.heroPost")}
          </h1>

          <p className="v2-hero-sub">{t("home.intro")}</p>

          <div className="hero-btns">
            <button className="btn btn-primary btn-lg" onClick={() => nav("/screening")}>
              {t("home.startBtn")} →
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => nav("/fatigue")}>
              {t("home.fatigueBtn")}
            </button>
          </div>

          <div className="v2-trust">
            {TRUST.map((key) => (
              <div className="v2-trust-item" key={key}>
                <svg className="v2-trust-check" viewBox="0 0 8 8" fill="none" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round">
                  <polyline points="1,4 3,6 7,2" />
                </svg>
                {t(key)}
              </div>
            ))}
          </div>
        </div>

        <div className="v2-hero-visual">
          <IrisCard />
        </div>
      </header>

      {/* STATS BAND */}
      <div className="v2-stats-band">
        {STATS.map((s) => (
          <StatTile key={s.key} stat={s} animate={!reduce} />
        ))}
      </div>

      {/* FEATURES */}
      <section className="features v2-features">
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
