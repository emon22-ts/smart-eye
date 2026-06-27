// Session history — lists persisted screenings from /api/sessions (real backend).
// Adds an OHI trend line, a fatigue column, and CSV export of all sessions.
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listSessions, deleteSession } from "../api";
import { COLOURS } from "../constants";
import { Met } from "../components";
import { useT } from "../i18n";

// Small self-contained OHI trend sparkline (0-100 scale, oldest -> newest).
function OhiTrend({ values }) {
  const { t } = useT();
  const w = 520;
  const h = 60;
  if (!values || values.length < 2) {
    return <p className="muted small">{t("hist.trendEmpty")}</p>;
  }
  const n = values.length;
  const pts = values
    .map((v, i) => {
      const x = (i / (n - 1)) * w;
      const y = h - (Math.max(0, Math.min(100, v)) / 100) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Reference line at OHI 67 (the Low/Moderate boundary).
  const ty = h - (67 / 100) * h;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h }}>
      <line x1="0" y1={ty} x2={w} y2={ty} stroke="var(--warning)" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Side-by-side comparison of any two saved sessions (uses already-loaded rows).
function CompareSessions({ rows }) {
  const { t } = useT();
  const valid = (rows || []).filter((r) => r.ohi != null);
  const [aId, setAId] = useState(valid[0]?.id);
  const [bId, setBId] = useState(valid[1]?.id);
  if (valid.length < 2) {
    return <p className="muted small">{t("hist.compareEmpty")}</p>;
  }
  const A = valid.find((r) => r.id === aId) || valid[0];
  const B = valid.find((r) => r.id === bId) || valid[1];
  const fmt = (r) => new Date(r.created_at).toLocaleString();
  const conf = (r) => (r.top_confidence == null ? "\u2014" : `${(r.top_confidence * 100).toFixed(0)}%`);
  const finding = (r) => (r.top_class ? t(`class.${r.top_class}`) : "\u2014");
  const fat = (r) => (r.fatigue_score == null ? "\u2014" : `${Math.round(r.fatigue_score)}/100`);
  const ohiDelta = Math.round(B.ohi - A.ohi);
  const lines = [
    ["OHI", Math.round(A.ohi), Math.round(B.ohi)],
    [t("hist.cmpRisk"), A.band || "\u2014", B.band || "\u2014"],
    [t("hist.cmpTop"), finding(A), finding(B)],
    [t("hist.cmpConf"), conf(A), conf(B)],
    [t("hist.cmpFat"), fat(A), fat(B)],
  ];
  return (
    <div className="cmp">
      <div className="cmp-selects">
        <select value={aId} onChange={(e) => setAId(Number(e.target.value))}>
          {valid.map((r) => <option key={r.id} value={r.id}>{`${fmt(r)} \u00b7 OHI ${Math.round(r.ohi)}`}</option>)}
        </select>
        <span className="cmp-vs">vs</span>
        <select value={bId} onChange={(e) => setBId(Number(e.target.value))}>
          {valid.map((r) => <option key={r.id} value={r.id}>{`${fmt(r)} \u00b7 OHI ${Math.round(r.ohi)}`}</option>)}
        </select>
      </div>
      <div className="cmp-grid">
        {lines.map(([label, a, b]) => (
          <div className="cmp-line" key={label}>
            <span className="cmp-a">{a}</span>
            <span className="cmp-lbl">{label}</span>
            <span className="cmp-b">{b}</span>
          </div>
        ))}
      </div>
      <p className="muted small cmp-foot">
        OHI change (right vs left):{" "}
        <b style={{ color: ohiDelta > 0 ? "var(--success)" : ohiDelta < 0 ? "var(--danger)" : "var(--muted)" }}>
          {ohiDelta > 0 ? `+${ohiDelta}` : ohiDelta}
        </b>{" "}
        {"\u2014 higher is healthier."}
      </p>
    </div>
  );
}

export default function History() {
  const { t } = useT();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const isGuest = typeof localStorage === "undefined" || !localStorage.getItem("se_token");
  const nav = useNavigate();

  const load = useCallback(async () => {
    if (isGuest) { setRows([]); return; }
    setError(null);
    try {
      setRows(await listSessions());
    } catch (e) {
      setError(`${t("hist.loadError")}: ${e.message}`);
      setRows([]);
    }
  }, [isGuest]);
  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    try {
      await deleteSession(id);
      setRows((rs) => (rs || []).filter((r) => r.id !== id));
    } catch (e) {
      setError(`Could not delete session: ${e.message}`);
    }
  };

  const badge = (colour, band) => {
    const col = COLOURS[colour] || "#64748b";
    return (
      <span className="risk-badge sm" style={{ color: col, borderColor: col, background: `${col}22` }}>
        {band || "—"}
      </span>
    );
  };

  // CSV export — generated entirely in the browser, no backend call.
  const exportCsv = () => {
    if (!rows || rows.length === 0) return;
    const header = ["id", "date", "ohi", "band", "top_finding", "confidence_pct", "fatigue_score", "symptoms_aggregate"];
    const escape = (v) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) => [
      r.id,
      new Date(r.created_at).toISOString(),
      r.ohi == null ? "" : Math.round(r.ohi),
      r.band || "",
      (r.top_class || "").replace(/_/g, " "),
      r.top_confidence == null ? "" : (r.top_confidence * 100).toFixed(0),
      r.fatigue_score == null ? "" : Math.round(r.fatigue_score),
      r.symptoms_aggregate == null ? "" : r.symptoms_aggregate,
    ].map(escape).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smart_eye_history_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // OHI values oldest -> newest for the trend (backend returns newest first).
  const ohiSeries = rows && rows.length
    ? rows.filter((r) => r.ohi != null).map((r) => r.ohi).reverse()
    : [];

  // Summary analytics over all sessions (computed entirely in the browser).
  const withOhi = (rows || []).filter((r) => r.ohi != null);
  const stats = withOhi.length
    ? {
        count: rows.length,
        avg: Math.round(withOhi.reduce((a, r) => a + r.ohi, 0) / withOhi.length),
        latest: Math.round(withOhi[0].ohi),
        highRisk: (rows || []).filter((r) => r.colour === "red").length,
      }
    : null;
  let trendArrow = "";
  let trendColour;
  if (stats && withOhi.length >= 2) {
    const delta = withOhi[0].ohi - withOhi[1].ohi; // newest minus previous
    if (delta > 1) { trendArrow = " \u2191"; trendColour = "var(--success)"; }
    else if (delta < -1) { trendArrow = " \u2193"; trendColour = "var(--danger)"; }
    else { trendArrow = " \u2192"; }
  }

  if (isGuest) {
    return (
      <main className="se-wrap page">
        <div className="page-head">
          <span className="eyebrow">{t("hist.eyebrow")}</span>
          <h1 className="page-h">{t("hist.title")}</h1>
        </div>
        <section className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3 style={{ marginBottom: 8 }}>{t("hist.signInTitle")}</h3>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            {t("hist.signInBody")}
          </p>
          <button className="btn btn-primary" onClick={() => nav("/login")}>{t("nav.signIn")}</button>
        </section>
      </main>
    );
  }

  return (
    <main className="se-wrap page">
      <div className="page-head">
        <span className="eyebrow">{t("hist.eyebrow")}</span>
        <h1 className="page-h">{t("hist.title")}</h1>
        <p className="lead">{t("hist.lead")}</p>
      </div>

      {error && <div className="err-strip">{error}</div>}

      {rows && rows.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="eyebrow">{t("hist.trend")}</span><h3>{t("hist.trendTitle")}</h3>
          </div>
          {stats && (
            <div className="metric-row" style={{ marginBottom: 16 }}>
              <Met label={t("hist.statScreenings")} value={stats.count} />
              <Met label={t("hist.statAvg")} value={stats.avg} />
              <Met label={t("hist.statLatest")} value={`${stats.latest}${trendArrow}`} accent={trendColour} />
              <Met label={t("hist.statHighRisk")} value={stats.highRisk} accent={stats.highRisk > 0 ? "var(--danger)" : undefined} />
            </div>
          )}
          <OhiTrend values={ohiSeries} />
          <p className="muted small" style={{ marginTop: 8 }}>
            {t("hist.trendCaption")}
          </p>
        </section>
      )}

      {rows && rows.length >= 2 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="eyebrow">{t("hist.compare")}</span><h3>{t("hist.compareTitle")}</h3>
          </div>
          <CompareSessions rows={rows} />
        </section>
      )}

      <section className="card">
        <div className="card-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><span className="eyebrow">{t("hist.records")}</span><h3>{t("hist.allSessions")}</h3></div>
          {rows && rows.length > 0 && (
            <button className="btn btn-ghost" onClick={exportCsv}>{t("hist.downloadCsv")}</button>
          )}
        </div>

        {rows === null ? (
          <div className="skel-wrap" aria-busy="true" aria-label={t("hist.loading")}>
            <div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" />
          </div>
        ) : rows.length === 0 ? (
          <p className="muted">{t("hist.empty")}</p>
        ) : (
          <div className="hist">
            <div className="hist-head hist-head-6">
              <span>{t("hist.colWhen")}</span><span>OHI</span><span>{t("hist.colRisk")}</span><span>{t("hist.colTop")}</span><span>{t("hist.colConf")}</span><span>{t("hist.colFat")}</span><span />
            </div>
            {rows.map((r) => (
              <div className="hist-row hist-row-6" key={r.id}>
                <span className="mono small">{new Date(r.created_at).toLocaleString()}</span>
                <span className="mono" style={{ color: COLOURS[r.colour] || "var(--fg)", fontSize: 17 }}>
                  {r.ohi == null ? "—" : Math.round(r.ohi)}
                </span>
                <span>{badge(r.colour, r.band)}</span>
                <span className="hist-top">
                  {r.top_class ? t(`class.${r.top_class}`) : "—"}
                  {r.is_mock ? <span className="mock-tag">mock</span> : null}
                </span>
                <span className="mono small">
                  {r.top_confidence == null ? "—" : `${(r.top_confidence * 100).toFixed(0)}%`}
                </span>
                <span className="mono small">
                  {r.fatigue_score == null ? "—" : `${Math.round(r.fatigue_score)}/100`}
                </span>
                <span><button className="btn-icon" onClick={() => remove(r.id)} title={t("hist.deleteTitle")}>✕</button></span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
