// Smart Eye — application shell. Injects the shared Concept C stylesheet + ambient
// backdrop, and owns the light/dark theme. The app opens on Home; signing in is
// optional (reachable at /login). A single /api/health check drives the model badge.
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { STYLES } from "./styles";
import { getHealth } from "./api";
import { useAuth } from "./auth";
import { Backdrop, NavBar, Footer } from "./components";
import Home from "./pages/Home.jsx";
import Screening from "./pages/Screening.jsx";
import Fatigue from "./pages/Fatigue.jsx";
import History from "./pages/History.jsx";
import Login from "./pages/Login.jsx";

function Shell({ isMock, theme, onToggleTheme, isAuthed }) {
  return (
    <>
      <NavBar isMock={isMock} theme={theme} onToggleTheme={onToggleTheme} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/screening" element={<Screening isMock={isMock} />} />
        <Route path="/fatigue" element={<Fatigue />} />
        <Route path="/history" element={<History />} />
        <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  const { ready, isAuthed } = useAuth();
  const [isMock, setIsMock] = useState(true);
  const [theme, setTheme] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("se_theme")) || "dark"
  );

  useEffect(() => {
    getHealth().then((h) => setIsMock(!!h.is_mock)).catch(() => {});
  }, [isAuthed]);

  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try { localStorage.setItem("se_theme", next); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className={`se-app${theme === "light" ? " theme-light" : ""}`}>
      <style>{STYLES}</style>
      <Backdrop />
      {!ready ? (
        <div className="boot"><div className="boot-spin" />Loading…</div>
      ) : (
        <Shell isMock={isMock} theme={theme} onToggleTheme={toggleTheme} isAuthed={isAuthed} />
      )}
    </div>
  );
}
