// Help & Education — public page explaining the four conditions Smart Eye screens
// for, general eye-health prevention tips, and how the screening pipeline works.
// Educational content only; not a medical diagnosis (see the closing disclaimer).
import React from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../i18n";

const CONDITIONS = ["normal", "cataract", "glaucoma", "dr"];
const TIPS = ["tip1", "tip2", "tip3", "tip4", "tip5", "tip6"];
const STEPS = ["how1", "how2", "how3"];

export default function Help() {
  const { t } = useT();
  const nav = useNavigate();

  return (
    <main className="se-wrap page help-page">
      <div className="page-head">
        <span className="eyebrow">{t("help.eyebrow")}</span>
        <h1 className="page-h">{t("help.title")}</h1>
        <p className="lead">{t("help.lead")}</p>
      </div>

      {/* Conditions */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="eyebrow">{t("help.condTitle")}</span></div>
        <div className="help-cond-grid">
          {CONDITIONS.map((c) => (
            <article className="help-cond anim-up" key={c}>
              <h3 className="help-cond-name">{t(`help.${c}.name`)}</h3>
              <p className="help-cond-what">{t(`help.${c}.what`)}</p>
              <div className="help-cond-meta">
                <span className="help-meta-lbl">{t("help.symptomsLabel")}</span>
                <span>{t(`help.${c}.signs`)}</span>
              </div>
              <div className="help-cond-meta">
                <span className="help-meta-lbl">{t("help.riskLabel")}</span>
                <span>{t(`help.${c}.risk`)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Prevention tips */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="eyebrow">{t("help.preventTitle")}</span></div>
        <p className="muted small" style={{ marginTop: -4, marginBottom: 16 }}>{t("help.preventSub")}</p>
        <div className="help-tips">
          {TIPS.map((tip) => (
            <div className="help-tip" key={tip}>
              <span className="help-tip-dot" />
              <div>
                <b>{t(`help.${tip}.t`)}</b>
                <p className="muted small">{t(`help.${tip}.d`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="eyebrow">{t("help.howTitle")}</span></div>
        <p className="muted small" style={{ marginTop: -4, marginBottom: 16 }}>{t("help.howSub")}</p>
        <div className="help-steps">
          {STEPS.map((s) => (
            <div className="help-step" key={s}>
              <b>{t(`help.${s}.t`)}</b>
              <p className="muted small">{t(`help.${s}.d`)}</p>
            </div>
          ))}
        </div>
        <p className="help-how-result">{t("help.howResult")}</p>
        <button className="btn btn-primary" onClick={() => nav("/screening")}>{t("help.ctaScreen")} →</button>
      </section>

      <p className="help-disclaimer">{t("help.disclaimer")}</p>
    </main>
  );
}
