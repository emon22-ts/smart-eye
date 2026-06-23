// Shared presentational components for Smart Eye, styled in the Concept C language.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink } from "react-router-dom";
import { COLOURS, SPARK_LEN } from "./constants";
import { useAuth } from "./auth";
import { listSessions, getHealth } from "./api";

export const EyeLogo = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="#fff" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3" fill="#fff" />
  </svg>
);

// Concept C signature: animated iris + scanner (camera-idle / hero visual).
export function IrisVisual() {
  return (
    <div className="iris-stage" aria-hidden="true">
      <div className="ring r2" />
      <div className="ring r1" />
      <div className="scan" />
      <div className="iris" />
      <div className="pupil" />
    </div>
  );
}

// Colour-banded circular Ocular Health Index gauge (ring + mono number + badge).
export function OHIGauge({ ohi, band, colour }) {
  const size = 168;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(ohi) || 0));
  const offset = c * (1 - pct / 100);
  const color = COLOURS[colour] || "#64748b";
  return (
    <div className="gauge">
      <svg width={size} height={size} role="img" aria-label={`Ocular Health Index ${Math.round(pct)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .6s ease, stroke .3s ease" }}
        />
        <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle"
              style={{ fill: color, fontFamily: "var(--mono)", fontSize: 42, fontWeight: 600 }}>
          {Math.round(pct)}
        </text>
        <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle"
              style={{ fill: "var(--muted-2)", fontSize: 11, letterSpacing: 1 }}>
          OHI / 100
        </text>
      </svg>
      <span className="risk-badge" style={{ color, borderColor: color, background: `${color}22` }}>
        {band || "—"} Risk
      </span>
    </div>
  );
}

// Per-class probability bars for the 4-class fundus taxonomy.
export function ClassBars({ probabilities, topClass }) {
  const entries = Object.entries(probabilities || {});
  if (entries.length === 0) {
    return <p className="muted small">No fundus image submitted — disease screening skipped.</p>;
  }
  entries.sort((a, b) => b[1] - a[1]);
  return (
    <div className="preds">
      {entries.map(([name, p]) => {
        const pct = (Number(p) * 100).toFixed(1);
        const isTop = name === topClass;
        return (
          <div className="pred" key={name}>
            <div className="pred-top">
              <b>{name.replace(/_/g, " ")}</b>
              <span className="mono" style={{ color: isTop ? "#7dd3fc" : "var(--muted)" }}>{pct}%</span>
            </div>
            <div className="bar"><i style={{ width: `${pct}%`, opacity: isTop ? 1 : 0.5 }} /></div>
          </div>
        );
      })}
    </div>
  );
}

// A 1-5 Likert selector row.
export function LikertRow({ label, value, onChange }) {
  return (
    <div className="likert">
      <span className="likert-label">{label}</span>
      <div className="likert-btns">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`likert-btn ${value === n ? "on" : ""}`}
            onClick={() => onChange(n)}
            aria-pressed={value === n}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

// EAR trend sparkline with the closed-eye threshold marked.
export function Sparkline({ history, threshold }) {
  const w = 520;
  const h = 46;
  if (!history || history.length < 2) {
    return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" />;
  }
  const max = 0.45;
  const pts = history
    .map((v, i) => {
      const x = (i / (SPARK_LEN - 1)) * w;
      const y = h - (Math.min(v, max) / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const ty = h - (threshold / max) * h;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <line x1="0" y1={ty} x2={w} y2={ty} stroke="var(--warning)" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      <polyline points={pts} fill="none" stroke="#22d3ee" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Image dropzone with click-to-browse and drag-and-drop.
export function Dropzone({ preview, onSelect, inputRef }) {
  const [drag, setDrag] = useState(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) onSelect(f);
  };
  return (
    <div
      className={`dropzone ${drag ? "drag" : ""} ${preview ? "has" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
    >
      {preview ? (
        <img src={preview} alt="Fundus preview" className="preview-img" />
      ) : (
        <div className="dz-empty">
          <div className="dz-ic">⬆</div>
          <div>Drop a fundus image, or click to browse</div>
          <div className="muted small">JPEG / PNG · 4-class screening</div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
        }}
      />
    </div>
  );
}

// Mono metric tile.
export function Met({ label, value, accent }) {
  return (
    <div className="met">
      <div className="met-l">{label}</div>
      <div className="met-v" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

// Fixed ambient backdrop (orbs + grid + vignette).
export function Backdrop() {
  return (
    <div className="backdrop">
      <div className="vignette" />
      <div className="grid-lines" />
      <div className="orb a" /><div className="orb b" /><div className="orb c" />
    </div>
  );
}

// Sticky top navigation with router links + model-status pill.
// Small hook: close a dropdown when clicking outside it or pressing Escape.
function useDismiss(open, setOpen) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, setOpen]);
  return ref;
}

export function ThemeToggle({ theme, onToggle }) {
  const light = theme === "light";
  return (
    <button className="icon-btn" onClick={onToggle} title={light ? "Switch to dark mode" : "Switch to light mode"} aria-label="Toggle theme">
      {light ? (
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </button>
  );
}

// Notification bell driven by real data: mock-model status + high-risk results.
export function NotificationsBell({ isMock }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(false);
  const ref = useDismiss(open, setOpen);

  const refresh = async () => {
    const list = [];
    if (isMock) {
      list.push({ kind: "warn", title: "Disease model in mock mode", body: "Screening probabilities are placeholders, not real results." });
    }
    try {
      const rows = await listSessions(50);
      for (const r of rows) {
        if (r.colour === "red") {
          list.push({
            kind: "alert",
            title: `High-risk screening · OHI ${r.ohi == null ? "—" : Math.round(r.ohi)}`,
            body: `${(r.top_class || "finding").replace(/_/g, " ")} · ${new Date(r.created_at).toLocaleString()}`,
          });
        }
      }
    } catch { /* backend not up; just show mock notice if any */ }
    setItems(list);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isMock]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) { refresh(); setSeen(true); }
  };
  const unread = seen ? 0 : items.length;

  return (
    <div className="nav-pop" ref={ref}>
      <button className="icon-btn" onClick={toggle} title="Notifications" aria-label="Notifications">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="pop-panel">
          <div className="pop-head">Notifications</div>
          {items.length === 0 ? (
            <div className="pop-empty">You're all caught up.</div>
          ) : (
            items.map((n, i) => (
              <div className={`pop-item ${n.kind}`} key={i}>
                <div className="pop-dot" />
                <div><b>{n.title}</b><span>{n.body}</span></div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function UserMenu({ onSignIn }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, setOpen);
  const signedIn = !!user;
  const label = user?.name || user?.email || "Guest";
  const initial = (label[0] || "G").toUpperCase();
  return (
    <div className="nav-pop" ref={ref}>
      <button className="user-btn" onClick={() => setOpen(!open)} aria-label="Account">
        <span className="avatar">{initial}</span>
        <span className="user-name">{signedIn ? label : "Guest"}</span>
      </button>
      {open && (
        <div className="pop-panel pop-right">
          <div className="pop-user">
            <span className="avatar lg">{initial}</span>
            <div>
              <b>{signedIn ? label : "Guest session"}</b>
              <span>{signedIn ? user?.email : "Not signed in"}</span>
            </div>
          </div>
          <button
            className="pop-action"
            onClick={() => { setOpen(false); if (signedIn) { logout(); } else { onSignIn && onSignIn(); } }}
          >
            {signedIn ? "Sign out" : "Sign in / Register"}
          </button>
        </div>
      )}
    </div>
  );
}

// Premium tabbed Sign In / Register modal (Concept C dark glass). Includes
// Continue with Google (active once the backend has OAuth credentials set).
// Auth0-style auth modal (clean white card). Rendered through a portal onto
// document.body so its fixed overlay is anchored to the viewport, not the
// blurred sticky nav. Includes Continue with Google (active once the backend
// has OAuth credentials configured).
const AUTH_MODAL_CSS = `
.amodal-overlay{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(6,10,18,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:amfade .18s ease}
.amodal{position:relative;width:min(400px,95vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.45);animation:amrise .22s cubic-bezier(.2,.8,.2,1);padding:34px 32px 28px;font-family:'Sora',system-ui,sans-serif}
.amodal-x{position:absolute;top:13px;right:13px;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#9aa3b2;font-size:21px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:background .15s,color .15s}
.amodal-x:hover{background:#f0f2f5;color:#3a4150}
.amodal-logo{width:54px;height:54px;border-radius:14px;margin:0 auto 16px;display:grid;place-items:center;background:linear-gradient(135deg,#3B82F6,#06B6D4);box-shadow:0 8px 22px rgba(59,130,246,.35)}
.amodal-logo svg{width:30px;height:30px}
.amodal-h{margin:0;text-align:center;color:#16202e;font:700 23px/1.2 'Sora',sans-serif}
.amodal-sub{margin:7px 0 22px;text-align:center;color:#697587;font:400 14px/1.45 'Sora',sans-serif}
.amodal-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 13px;border-radius:10px;font:500 12.5px/1.4 'Sora',sans-serif;margin-bottom:14px}
.amodal-form{display:flex;flex-direction:column;gap:12px}
.amodal-ipt{position:relative;display:flex;align-items:center}
.amodal-ipt>svg{position:absolute;left:13px;width:18px;height:18px;color:#9aa3b2;pointer-events:none}
.amodal-ipt input{width:100%;padding:13px 14px 13px 42px;border-radius:10px;border:1px solid #d9dee6;background:#fff;color:#16202e;font:500 14.5px/1 'Sora',sans-serif;outline:none;transition:border-color .15s,box-shadow .15s}
.amodal-ipt input::placeholder{color:#9aa3b2}
.amodal-ipt input:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
.amodal-ipt.has-eye input{padding-right:42px}
.amodal-eye{position:absolute;right:8px;width:30px;height:30px;border:0;background:transparent;color:#9aa3b2;cursor:pointer;display:grid;place-items:center;border-radius:7px}
.amodal-eye:hover{color:#3B82F6;background:#f0f6ff}
.amodal-submit{margin-top:6px;padding:13px;border:0;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#06B6D4);color:#fff;font:700 15px/1 'Sora',sans-serif;cursor:pointer;transition:transform .12s,box-shadow .12s,opacity .12s;box-shadow:0 10px 24px rgba(59,130,246,.32)}
.amodal-submit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 14px 30px rgba(59,130,246,.42)}
.amodal-submit:disabled{opacity:.6;cursor:not-allowed}
.amodal-or{display:flex;align-items:center;gap:12px;margin:18px 0;color:#9aa3b2;font:600 11px/1 'Sora',sans-serif;letter-spacing:1px}
.amodal-or::before,.amodal-or::after{content:"";height:1px;flex:1;background:#e6e9ee}
.amodal-google{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;padding:12px;border-radius:10px;border:1px solid #d9dee6;background:#fff;color:#16202e;font:600 14px/1 'Sora',sans-serif;cursor:pointer;transition:background .12s,box-shadow .12s,opacity .12s}
.amodal-google:hover:not(:disabled){background:#f7f9fc;box-shadow:0 4px 14px rgba(0,0,0,.08)}
.amodal-google:disabled{opacity:.5;cursor:not-allowed}
.amodal-note{margin:9px 2px 0;color:#9aa3b2;font:400 11.5px/1.45 'Sora',sans-serif;text-align:center}
.amodal-switch{margin:20px 0 0;text-align:center;color:#697587;font:500 13.5px/1 'Sora',sans-serif}
.amodal-switch button{background:none;border:0;color:#3B82F6;font:700 13.5px/1 'Sora',sans-serif;cursor:pointer;padding:0 2px}
.amodal-switch button:hover{text-decoration:underline}
@keyframes amfade{from{opacity:0}to{opacity:1}}
@keyframes amrise{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
`;

const AM_MAIL = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
);
const AM_LOCK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const AM_USER = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
const AM_EYE = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const AM_EYE_OFF = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
    <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 7 10 7a13.6 13.6 0 0 1-2.2 3" />
    <path d="M6.1 6.1A13.6 13.6 0 0 0 2 11s3.5 7 10 7a10.9 10.9 0 0 0 2.1-.2" />
  </svg>
);

export function AuthModal({ open, onClose }) {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    getHealth().then((h) => setGoogleOn(!!h.google_auth_configured)).catch(() => {});
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isReg = mode === "register";
  const flip = () => { setMode(isReg ? "login" : "register"); setError(null); };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (isReg) {
      if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (password !== confirm) { setError("Passwords do not match."); return; }
    }
    setBusy(true);
    try {
      if (isReg) await register(email.trim(), password, name.trim());
      else await login(email.trim(), password);
      onClose();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="amodal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{AUTH_MODAL_CSS}</style>
      <div className="amodal" role="dialog" aria-modal="true">
        <button className="amodal-x" onClick={onClose} aria-label="Close">×</button>
        <div className="amodal-logo"><EyeLogo /></div>
        <h2 className="amodal-h">{isReg ? "Create your account" : "Welcome back"}</h2>
        <p className="amodal-sub">
          {isReg ? "Register to save your screenings to a private history." : "Sign in to continue to Smart Eye."}
        </p>

        {error && <div className="amodal-err">{error}</div>}

        <form onSubmit={submit} className="amodal-form">
          {isReg && (
            <div className="amodal-ipt">{AM_USER}
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" />
            </div>
          )}
          <div className="amodal-ipt">{AM_MAIL}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required />
          </div>
          <div className="amodal-ipt has-eye">{AM_LOCK}
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isReg ? "Password (min 6 characters)" : "Password"}
              autoComplete={isReg ? "new-password" : "current-password"}
              required
            />
            <button type="button" className="amodal-eye" onClick={() => setShowPw(!showPw)} aria-label="Toggle password visibility">
              {showPw ? AM_EYE_OFF : AM_EYE}
            </button>
          </div>
          {isReg && (
            <div className="amodal-ipt">{AM_LOCK}
              <input type={showPw ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" required />
            </div>
          )}
          <button type="submit" className="amodal-submit" disabled={busy}>
            {busy ? "Please wait…" : isReg ? "Create account" : "Continue"}
          </button>
        </form>

        <div className="amodal-or"><span>OR</span></div>

        <button
          type="button"
          className="amodal-google"
          onClick={loginWithGoogle}
          disabled={!googleOn}
          title={googleOn ? "Continue with Google" : "Google sign-in is not configured on the server"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
          </svg>
          Continue with Google
        </button>
        {!googleOn && <p className="amodal-note">Continue with Google activates once the server has OAuth credentials set.</p>}

        <p className="amodal-switch">
          {isReg ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" onClick={flip}>{isReg ? "Log in" : "Sign up"}</button>
        </p>
      </div>
    </div>,
    document.body
  );
}

export function NavBar({ isMock, theme, onToggleTheme }) {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  return (
    <nav className="se-nav">
      <style>{`.se-signin{padding:8px 17px;border:0;border-radius:10px;background:linear-gradient(135deg,#3B82F6,#06B6D4);color:#fff;font:700 13px/1 'Sora',sans-serif;letter-spacing:.2px;cursor:pointer;transition:transform .12s,box-shadow .12s,filter .12s;box-shadow:0 6px 16px rgba(59,130,246,.32);white-space:nowrap}.se-signin:hover{transform:translateY(-1px);filter:brightness(1.06);box-shadow:0 9px 20px rgba(59,130,246,.42)}`}</style>
      <div className="se-wrap nav-in">
        <NavLink to="/" className="brand" onClick={closeMenu}>
          <div className="logo"><EyeLogo /></div>
          <div><b>SMART EYE</b><span className="tag">Clinical Intelligence</span></div>
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/screening">Screening</NavLink>
          <NavLink to="/fatigue">Fatigue</NavLink>
          <NavLink to="/history">History</NavLink>
        </div>
        <div className="nav-status">
          <span className={`pill pill-sm ${isMock ? "pill-warn" : "pill-ok"}`}>
            <span className="dot" />{isMock ? "Mock" : "Live"}
          </span>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <NotificationsBell isMock={isMock} />
          {!user && <button className="se-signin" onClick={() => setAuthOpen(true)}>Sign in</button>}
          <UserMenu onSignIn={() => setAuthOpen(true)} />
        </div>
        <button
          className="nav-burger"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className={`burger-bars${menuOpen ? " open" : ""}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="nav-mobile">
          <NavLink to="/" end onClick={closeMenu}>Home</NavLink>
          <NavLink to="/screening" onClick={closeMenu}>Screening</NavLink>
          <NavLink to="/fatigue" onClick={closeMenu}>Fatigue</NavLink>
          <NavLink to="/history" onClick={closeMenu}>History</NavLink>
          <div className="nav-mobile-foot">
            <span className={`pill pill-sm ${isMock ? "pill-warn" : "pill-ok"}`}>
              <span className="dot" />{isMock ? "Mock" : "Live"}
            </span>
            {!user && (
              <button className="se-signin" onClick={() => { setAuthOpen(true); closeMenu(); }}>
                Sign in
              </button>
            )}
          </div>
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="se-footer">
      <div className="se-wrap foot-in">
        <span>© 2026 Smart Eye · Final Year Project</span>
        <span className="muted-2">GDPR-Compliant · Local Processing · No Cloud Image Storage</span>
      </div>
    </footer>
  );
}

// Mock-model banner + non-dismissible clinical disclaimer (+ optional error).
export function Banners({ isMock, error }) {
  return (
    <>
      {isMock && (
        <div className="mock-strip">⚠ MOCK MODEL ACTIVE — disease probabilities are placeholders, NOT a screening result.</div>
      )}
      {error && <div className="err-strip">{error}</div>}
      <div className="disc-in">
        <div className="ic">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8">
            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        </div>
        <p>
          <b>Preliminary screening only.</b> Smart Eye is a preliminary screening and triage support
          utility. It does NOT provide a clinical diagnosis. Final medical conclusions remain entirely
          the responsibility of qualified healthcare professionals.
        </p>
      </div>
    </>
  );
}
