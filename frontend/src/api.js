// Thin client for the Smart Eye FastAPI backend.
// API_BASE="" => same-origin requests, forwarded by the Vite dev proxy
// (vite.config.js -> http://localhost:8000). Set to a full origin for a
// proxy-less production build (the backend CORS list must then include it).
export const API_BASE = "";

// Attach the stored bearer token (if signed in) so session data is user-scoped.
// Guests have no token -> requests are anonymous, exactly as before.
function authHeader() {
  const t = typeof localStorage !== "undefined" ? localStorage.getItem("se_token") : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function asJson(res) {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error || body.detail || "";
    } catch { /* non-JSON error */ }
    throw new Error(detail || `server responded ${res.status}`);
  }
  return res.json();
}

// ----- health -----
export function getHealth() {
  return fetch(`${API_BASE}/api/health`).then(asJson);
}

// ----- auth -----
export function register({ email, password, name }) {
  return fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  }).then(asJson);
}

export function login({ email, password }) {
  return fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).then(asJson);
}

export function getMe() {
  return fetch(`${API_BASE}/api/auth/me`, { headers: { ...authHeader() } }).then(asJson);
}

// ----- fatigue (anonymous; no auth needed) -----
export function postFatigueFrame(landmarks) {
  return fetch(`${API_BASE}/api/fatigue/frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ landmarks_68: landmarks }),
  }).then(asJson);
}

// ----- screening + history (user-scoped when signed in) -----
export function scoreSession({ file, symptoms, fatigue }) {
  const params = new URLSearchParams({
    pain: symptoms.pain,
    redness: symptoms.redness,
    photophobia: symptoms.photophobia,
    blurred_vision: symptoms.blurred_vision,
    fatigue_score: fatigue?.fatigue_score ?? 0,
    drowsy: String(fatigue?.drowsy ?? false),
    blink_rate_bpm: fatigue?.blink_rate_bpm ?? 0,
  });
  const fd = new FormData();
  if (file) fd.append("file", file);
  return fetch(`${API_BASE}/api/session/score?${params.toString()}`, {
    method: "POST",
    headers: { ...authHeader() },
    body: fd,
  }).then(asJson);
}

// ----- Grad-CAM explainability (posts the same fundus image to the explain endpoint) -----
export function explainImage(file, className) {
  const fd = new FormData();
  fd.append("file", file);
  const qs = className ? `?class_name=${encodeURIComponent(className)}` : "";
  return fetch(`${API_BASE}/api/screen/image/explain${qs}`, {
    method: "POST",
    headers: { ...authHeader() },
    body: fd,
  }).then(asJson);
}

export function listSessions(limit = 100) {
  return fetch(`${API_BASE}/api/sessions?limit=${limit}`, { headers: { ...authHeader() } }).then(asJson);
}

export function getSession(id) {
  return fetch(`${API_BASE}/api/sessions/${id}`, { headers: { ...authHeader() } }).then(asJson);
}

export function deleteSession(id) {
  return fetch(`${API_BASE}/api/sessions/${id}`, {
    method: "DELETE",
    headers: { ...authHeader() },
  }).then(asJson);
}

// Fetch the server-generated professional PDF report for a session as a Blob.
async function fetchSessionPdfBlob(id) {
  const res = await fetch(`${API_BASE}/api/sessions/${id}/pdf`, { headers: { ...authHeader() } });
  if (!res.ok) {
    let detail = "";
    try { const b = await res.json(); detail = b.error || b.detail || ""; } catch { /* non-JSON */ }
    throw new Error(detail || `server responded ${res.status}`);
  }
  return res.blob();
}

// Download the server-generated professional PDF report for a session (returns a file).
export async function downloadSessionPdf(id) {
  const blob = await fetchSessionPdfBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smart_eye_report_${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Share the PDF via the native share sheet (Web Share API, level 2 — files).
// Returns "shared" on success, "unsupported" if the browser can't share files
// (caller should fall back to download), or throws "cancelled" if the user
// dismissed the share sheet.
export async function sharePdf(id) {
  const blob = await fetchSessionPdfBlob(id);
  const file = new File([blob], `smart_eye_report_${id}.pdf`, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Smart Eye — Ocular Health Report",
        text: "My Smart Eye screening report.",
      });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("cancelled");
      throw e;
    }
  }
  return "unsupported";
}
