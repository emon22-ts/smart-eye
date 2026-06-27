// Analytics dashboard — aggregates the signed-in user's saved screenings into
// totals, a disease-distribution breakdown, a risk split, and an OHI trend line.
// Signed-in only (guests have no saved history); all data comes from /api/sessions.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSessions } from "../api";
import { COLOURS } from "../constants";
import { Met } from "../components";
import { useT } from "../i18n";

// Compact OHI trend line (0-100 scale, oldest -> newest).
function TrendLine({ values }) {
  const w = 560;
  const h = 90;
  if (!values || values.length < 2) return null;
  const max = 100;
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * stepX},${h - (Math.max(0, Math.min(100, v)) / max) * h}`).join(" ");
  const areaPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="an-trend-svg" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="anTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(59,130,246,.32)" />
          <stop offset="100%" stopColor="rgba(59,130,246,0)" />
        </linearGradient>
      </defs>
      <line x1="0" y1={h - (67 / 100) * h} x2={w} y2={h - (67 / 100) * h} stroke="var(--border-2)" strokeDasharray="5 5" strokeWidth="1" />
      <polygon points={areaPts} fill="url(#anTrendFill)" />
      <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function Analytics() {
  const { t } = useT();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const isGuest = !localStorage.getItem("se_token");

  const load = useCallback(async () => {
    if (isGuest) { setRows([]); return; }
    try { setRows(await listSessions()); }
    catch { setRows([]); }
  }, [isGuest]);
  useEffect(() => { load(); }, [load]);

  const data = useMemo(() => {
    const r = rows || [];
    const withOhi = r.filter((x) => x.ohi != null);
    const withFat = r.filter((x) => x.fatigue_score != null);
    const diseaseCounts = {};
    r.forEach((x) => { if (x.top_class) diseaseCounts[x.top_class] = (diseaseCounts[x.top_class] || 0) + 1; });
    const risk = {
      green: r.filter((x) => x.colour === "green").length,
      amber: r.filter((x) => x.colour === "amber").length,
      red: r.filter((x) => x.colour === "red").length,
    };
    return {
      total: r.length,
      avgOhi: withOhi.length ? Math.round(withOhi.reduce((a, x) => a + x.ohi, 0) / withOhi.length) : "—",
      highRisk: risk.red,
      avgFatigue: withFat.length ? Math.round(withFat.reduce((a, x) => a + x.fatigue_score, 0) / withFat.length) : "—",
      diseaseCounts,
      risk,
      ohiSeries: withOhi.map((x) => x.ohi).reverse(), // oldest -> newest
    };
  }, [rows]);

  if (isGuest) {
    return (
      <main className="se-wrap page">
        <div className="page-head">
          <span className="eyebrow">{t("an.eyebrow")}</span>
          <h1 className="page-h">{t("an.title")}</h1>
        </div>
        <section className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3 style={{ marginBottom: 8 }}>{t("an.signInTitle")}</h3>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            {t("an.signInBody")}
          </p>
          <button className="btn btn-primary" onClick={() => nav("/login")}>{t("nav.signIn")}</button>
        </section>
      </main>
    );
  }

  const diseaseMax = Math.max(1, ...Object.values(data.diseaseCounts));
  const orderedDiseases = Object.keys(data.diseaseCounts)
    .filter((name) => data.diseaseCounts[name] > 0)
    .sort((a, b) => (data.diseaseCounts[b] || 0) - (data.diseaseCounts[a] || 0));
  const riskTotal = data.risk.green + data.risk.amber + data.risk.red;

  return (
    <main className="se-wrap page">
      <div className="page-head">
        <span className="eyebrow">{t("an.eyebrow")}</span>
        <h1 className="page-h">{t("an.title")}</h1>
        <p className="lead">{t("an.lead")}</p>
      </div>

      {rows === null ? (
        <div className="skel-wrap" aria-busy="true">
          <div className="skel skel-row" style={{ height: 90 }} /><div className="skel skel-row" style={{ height: 220 }} />
        </div>
      ) : data.total === 0 ? (
        <section className="card"><p className="muted">{t("an.empty")}</p></section>
      ) : (
        <>
          <div className="metric-row an-stats">
            <Met label={t("an.statTotal")} value={data.total} />
            <Met label={t("an.statAvg")} value={data.avgOhi} />
            <Met label={t("an.statHigh")} value={data.highRisk} accent={data.highRisk > 0 ? "var(--danger)" : undefined} />
            <Met label={t("an.statFatigue")} value={data.avgFatigue} />
          </div>

          <div className="an-grid">
            <section className="card">
              <div className="card-head"><span className="eyebrow">{t("an.diseaseTitle")}</span></div>
              <p className="muted small" style={{ marginTop: -4, marginBottom: 14 }}>{t("an.diseaseSub")}</p>
              {orderedDiseases.length === 0 ? (
                <p className="muted small">{t("an.noFinding")}</p>
              ) : (
                <div className="an-dist">
                  {orderedDiseases.map((name) => {
                    const count = data.diseaseCounts[name];
                    const pct = Math.round((count / data.total) * 100);
                    return (
                      <div className="an-dist-row" key={name}>
                        <div className="an-dist-top">
                          <b>{t(`class.${name}`)}</b>
                          <span className="mono small muted">{count} {t("an.scans")} · {pct}%</span>
                        </div>
                        <div className="an-bar"><i style={{ width: `${(count / diseaseMax) * 100}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head"><span className="eyebrow">{t("an.riskTitle")}</span></div>
              <div className="an-risk-bar" role="img" aria-label={t("an.riskTitle")}>
                {data.risk.green > 0 && <span style={{ flex: data.risk.green, background: COLOURS.green }} />}
                {data.risk.amber > 0 && <span style={{ flex: data.risk.amber, background: COLOURS.amber }} />}
                {data.risk.red > 0 && <span style={{ flex: data.risk.red, background: COLOURS.red }} />}
              </div>
              <div className="an-risk-legend">
                <span><i style={{ background: COLOURS.green }} />{t("filter.riskLow")} · {data.risk.green}</span>
                <span><i style={{ background: COLOURS.amber }} />{t("filter.riskModerate")} · {data.risk.amber}</span>
                <span><i style={{ background: COLOURS.red }} />{t("filter.riskHigh")} · {data.risk.red}</span>
              </div>
            </section>
          </div>

          {data.ohiSeries.length >= 2 && (
            <section className="card" style={{ marginTop: 16 }}>
              <div className="card-head"><span className="eyebrow">{t("an.trendTitle")}</span></div>
              <p className="muted small" style={{ marginTop: -4, marginBottom: 12 }}>{t("an.trendSub")}</p>
              <TrendLine values={data.ohiSeries} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
