// User Profile — view/edit personal details and health context. Persisted to
// localStorage, namespaced per account email (the backend stores only name/email,
// so richer profile data lives client-side, consistent with theme/language prefs).
// Language and theme changes apply immediately app-wide.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useT, LANGS } from "../i18n";
import { useToast } from "../toast";

const EMPTY = {
  photo: "", name: "", age: "", gender: "unspecified",
  diabetes: "no", hypertension: "no", familyHistory: "no", vision: "none",
};

function profileKey(email) { return `se_profile:${email || "anon"}`; }

function loadProfile(email) {
  try {
    const raw = localStorage.getItem(profileKey(email));
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...EMPTY };
}

export default function Profile() {
  const { user } = useAuth();
  const { t, lang, setLang } = useT();
  const { toast } = useToast();
  const nav = useNavigate();
  const fileRef = useRef(null);
  const isGuest = !localStorage.getItem("se_token");
  const email = user?.email || "";

  const [form, setForm] = useState(() => {
    const p = loadProfile(email);
    if (!p.name && user?.name) p.name = user.name;
    return p;
  });
  const [theme, setTheme] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("se_theme")) || "dark"
  );

  // Reload the stored profile if the signed-in account changes.
  useEffect(() => {
    const p = loadProfile(email);
    if (!p.name && user?.name) p.name = user.name;
    setForm(p);
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast(t("profile.photoTooBig"), "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale to a 256px square to keep localStorage small.
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        set("photo", canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const applyTheme = (next) => {
    setTheme(next);
    try { localStorage.setItem("se_theme", next); } catch { /* ignore */ }
    const root = document.querySelector(".se-app");
    if (root) root.classList.toggle("theme-light", next === "light");
  };

  const applyLanguage = (code) => setLang(code); // updates context + localStorage app-wide

  const save = () => {
    try { localStorage.setItem(profileKey(email), JSON.stringify(form)); } catch { /* ignore */ }
    toast(t("profile.saved"), "success");
  };

  if (isGuest) {
    return (
      <main className="se-wrap page">
        <div className="page-head">
          <span className="eyebrow">{t("profile.eyebrow")}</span>
          <h1 className="page-h">{t("profile.title")}</h1>
        </div>
        <section className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3 style={{ marginBottom: 8 }}>{t("profile.signInTitle")}</h3>
          <p className="muted" style={{ marginBottom: 20, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            {t("profile.signInBody")}
          </p>
          <button className="btn btn-primary" onClick={() => nav("/login")}>{t("nav.signIn")}</button>
        </section>
      </main>
    );
  }

  const initial = (form.name || email || "U")[0].toUpperCase();

  return (
    <main className="se-wrap page">
      <div className="page-head">
        <span className="eyebrow">{t("profile.eyebrow")}</span>
        <h1 className="page-h">{t("profile.title")}</h1>
        <p className="lead">{t("profile.lead")}</p>
      </div>

      <section className="card prof-card">
        {/* Photo */}
        <div className="prof-photo-row">
          <div className="prof-avatar">
            {form.photo ? <img src={form.photo} alt="" /> : <span>{initial}</span>}
          </div>
          <div className="prof-photo-actions">
            <span className="sub-lbl">{t("profile.photo")}</span>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhoto} />
            <div className="prof-photo-btns">
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>{t("profile.changePhoto")}</button>
              {form.photo && <button className="btn btn-ghost btn-sm" onClick={() => set("photo", "")}>{t("profile.removePhoto")}</button>}
            </div>
          </div>
        </div>

        {/* Account */}
        <h3 className="prof-sec">{t("profile.secAccount")}</h3>
        <div className="prof-grid">
          <label className="field">
            <span>{t("profile.name")}</span>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="field">
            <span>{t("profile.email")}</span>
            <input value={email} disabled />
            <small className="muted">{t("profile.emailNote")}</small>
          </label>
          <label className="field">
            <span>{t("profile.age")}</span>
            <input type="number" min="0" max="120" value={form.age} onChange={(e) => set("age", e.target.value)} />
          </label>
          <label className="field">
            <span>{t("profile.gender")}</span>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="unspecified">{t("profile.gUnspecified")}</option>
              <option value="male">{t("profile.gMale")}</option>
              <option value="female">{t("profile.gFemale")}</option>
              <option value="other">{t("profile.gOther")}</option>
            </select>
          </label>
        </div>

        {/* Health context */}
        <h3 className="prof-sec">{t("profile.secHealth")}</h3>
        <div className="prof-grid">
          <label className="field">
            <span>{t("profile.diabetes")}</span>
            <select value={form.diabetes} onChange={(e) => set("diabetes", e.target.value)}>
              <option value="no">{t("profile.optNo")}</option>
              <option value="yes">{t("profile.optYes")}</option>
              <option value="pre">{t("profile.optPre")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("profile.hypertension")}</span>
            <select value={form.hypertension} onChange={(e) => set("hypertension", e.target.value)}>
              <option value="no">{t("profile.optNo")}</option>
              <option value="yes">{t("profile.optYes")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("profile.familyHistory")}</span>
            <select value={form.familyHistory} onChange={(e) => set("familyHistory", e.target.value)}>
              <option value="no">{t("profile.optNo")}</option>
              <option value="yes">{t("profile.optYes")}</option>
            </select>
          </label>
          <label className="field">
            <span>{t("profile.vision")}</span>
            <select value={form.vision} onChange={(e) => set("vision", e.target.value)}>
              <option value="none">{t("profile.vNone")}</option>
              <option value="glasses">{t("profile.vGlasses")}</option>
              <option value="contacts">{t("profile.vContacts")}</option>
            </select>
          </label>
        </div>

        {/* Preferences */}
        <h3 className="prof-sec">{t("profile.secPrefs")}</h3>
        <div className="prof-grid">
          <label className="field">
            <span>{t("profile.language")}</span>
            <select value={lang} onChange={(e) => applyLanguage(e.target.value)}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t("profile.theme")}</span>
            <select value={theme} onChange={(e) => applyTheme(e.target.value)}>
              <option value="dark">{t("profile.themeDark")}</option>
              <option value="light">{t("profile.themeLight")}</option>
            </select>
          </label>
        </div>

        <div className="prof-save">
          <button className="btn btn-primary" onClick={save}>{t("profile.save")}</button>
        </div>
      </section>
    </main>
  );
}
