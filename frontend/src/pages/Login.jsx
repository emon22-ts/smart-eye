// Login / register entry. Offers email-password auth, Google sign-in (when the
// server is configured for it), and a one-click guest mode that needs no account.
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { getHealth } from "../api";
import { EyeLogo } from "../components";
import { useT } from "../i18n";

const GOOGLE_ERROR_KEYS = {
  google_not_configured: "auth.googleErrNotConfigured",
  google_failed: "auth.googleErrFailed",
};

export default function Login() {
  const { login, register, loginWithGoogle, continueAsGuest } = useAuth();
  const { t } = useT();
  const [params] = useSearchParams();
  const [mode, setMode] = useState("login"); // login | register
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    const e = params.get("error");
    if (e) setError(t(GOOGLE_ERROR_KEYS[e] || "auth.signInFailed"));
    getHealth().then((h) => setGoogleOn(!!h.google_auth_configured)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password, name.trim());
      // AuthProvider flips isAuthed -> App renders the app; nothing else to do.
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo"><EyeLogo /></div>
          <div><b>SMART EYE</b><span className="tag">{t("auth.brandSub")}</span></div>
        </div>

        <h1 className="auth-h">{mode === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}</h1>
        <p className="auth-sub">
          {mode === "login"
            ? t("auth.subLogin")
            : t("auth.subRegister")}
        </p>

        {error && <div className="err-strip">{error}</div>}

        <button
          type="button"
          className="btn btn-google"
          onClick={loginWithGoogle}
          disabled={!googleOn}
          title={googleOn ? t("auth.googleContinue") : t("auth.googleNotConfigured")}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
          </svg>
          {t("auth.googleContinue")}
        </button>
        {!googleOn && (
          <p className="muted small auth-note">{t("auth.googleNote")}</p>
        )}

        <div className="auth-or"><span>{t("auth.or")}</span></div>

        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label className="field">
              <span>{t("auth.name")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.namePlaceholder")} autoComplete="name" />
            </label>
          )}
          <label className="field">
            <span>{t("auth.email")}</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </label>
          <label className="field">
            <span>{t("auth.password")}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "register" ? t("auth.passwordRegister") : t("auth.passwordLogin")} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? t("auth.pleaseWait") : mode === "login" ? t("auth.signIn") : t("auth.createAccountBtn")}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login" ? t("auth.newHere") : t("auth.haveAccount")}{" "}
          <button type="button" className="link-btn" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}>
            {mode === "login" ? t("auth.createLink") : t("auth.signIn")}
          </button>
        </p>

        <div className="auth-guest">
          <button type="button" className="btn btn-ghost btn-block" onClick={continueAsGuest}>
            {t("auth.continueGuest")}
          </button>
          <p className="muted small auth-note">{t("auth.guestNote")}</p>
        </div>
      </div>

      <p className="auth-disc">
        Smart Eye is a preliminary screening utility and does not provide a clinical diagnosis.
      </p>
    </main>
  );
}
