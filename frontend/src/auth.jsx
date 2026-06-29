// Auth context for Smart Eye.
// - email/password + Google tokens are stored in localStorage ("se_token")
// - guest mode is a local flag ("se_guest") — no account, anonymous sessions
// - Google sign-in returns via a URL fragment (#token=...) which we consume here
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE, login as apiLogin, register as apiRegister, getMe } from "./api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// OAuth full-page redirect must go straight to the backend origin (not the SPA),
// because Google redirects back to the backend callback. In dev that's :8000.
const OAUTH_BASE = API_BASE || "http://localhost:8000";

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // 1) Returning from Google? token is in the URL fragment.
      const hash = window.location.hash || "";
      if (hash.includes("token=")) {
        const p = new URLSearchParams(hash.slice(1));
        const t = p.get("token");
        if (t) {
          localStorage.setItem("se_token", t);
          localStorage.removeItem("se_guest");
          setToken(t);
          setUser({ email: p.get("email"), name: p.get("name") });
          window.history.replaceState(null, "", "/login");
          setReady(true);
          navigate("/", { replace: true });
          return;
        }
      }
      // 2) Existing token? validate it against the backend.
      const t = localStorage.getItem("se_token");
      if (t) {
        try {
          const me = await getMe();
          setToken(t);
          setUser(me.user);
        } catch {
          localStorage.removeItem("se_token");
        }
        setReady(true);
        return;
      }
      // 3) Guest?
      if (localStorage.getItem("se_guest") === "1") setIsGuest(true);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const data = await apiLogin({ email, password });
    localStorage.setItem("se_token", data.token);
    localStorage.removeItem("se_guest");
    setToken(data.token);
    setIsGuest(false);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const data = await apiRegister({ email, password, name });
    localStorage.setItem("se_token", data.token);
    localStorage.removeItem("se_guest");
    setToken(data.token);
    setIsGuest(false);
    setUser(data.user);
    return data.user;
  };

  const loginWithGoogle = () => {
    window.location.href = `${OAUTH_BASE}/api/auth/google/login`;
  };

  const continueAsGuest = () => {
    localStorage.setItem("se_guest", "1");
    localStorage.removeItem("se_token");
    setToken(null);
    setUser(null);
    setIsGuest(true);
    navigate("/", { replace: true });
  };

  const logout = () => {
    localStorage.removeItem("se_token");
    localStorage.removeItem("se_guest");
    // Clear the "already prompted" flag so the next fresh login cycle
    // will show the auth modal again on home if the user comes back.
    sessionStorage.removeItem("se_auth_prompted");
    setToken(null);
    setUser(null);
    setIsGuest(false);
    navigate("/", { replace: true });
  };

  const value = {
    user, token, isGuest, ready,
    isAuthed: !!user || isGuest,
    login, register, loginWithGoogle, continueAsGuest, logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
