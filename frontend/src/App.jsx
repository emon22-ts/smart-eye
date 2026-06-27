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
import Analytics from "./pages/Analytics.jsx";
import Help from "./pages/Help.jsx";
import Login from "./pages/Login.jsx";

// Catches render-time errors anywhere below it, so one thrown error shows a
// recovery screen instead of unmounting the whole app to a blank white page.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Smart Eye render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="boot" role="alert">
          <h2 style={{ color: "var(--fg)", fontSize: 20, fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ maxWidth: 420, textAlign: "center" }}>
            The interface hit an unexpected error and stopped rendering. Your data is safe.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload the app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell({ isMock, theme, onToggleTheme, a11y, onToggleA11y, isAuthed }) {
  return (
    <>
      <NavBar isMock={isMock} theme={theme} onToggleTheme={onToggleTheme} a11y={a11y} onToggleA11y={onToggleA11y} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/screening" element={<Screening isMock={isMock} />} />
        <Route path="/fatigue" element={<Fatigue />} />
        <Route path="/history" element={<History />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/help" element={<Help />} />
        <Route path="/login" element={isAuthed ? <Navigate to="/" replace /> : <Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  const { ready, isAuthed } = useAuth();
  const [isMock, setIsMock] = useState(null); // null = health not known yet (prevents a false "MOCK" flash on load)
  const [theme, setTheme] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("se_theme")) || "dark"
  );
  const [a11y, setA11y] = useState(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("se_a11y") === "1")
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

  const toggleA11y = () => {
    setA11y((v) => {
      const next = !v;
      try { localStorage.setItem("se_a11y", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className={`se-app${theme === "light" ? " theme-light" : ""}${a11y ? " a11y" : ""}`}>
      <style>{STYLES}</style>
      <Backdrop />
      {!ready ? (
        <div className="boot"><div className="boot-spin" />Loading…</div>
      ) : (
        <ErrorBoundary>
          <Shell isMock={isMock} theme={theme} onToggleTheme={toggleTheme} a11y={a11y} onToggleA11y={toggleA11y} isAuthed={isAuthed} />
        </ErrorBoundary>
      )}
    </div>
  );
}
