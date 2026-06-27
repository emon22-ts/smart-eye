// Lightweight toast notifications — no external library.
//
// A context exposes `toast(message, type, ms)`; the provider renders a fixed
// viewport (top-right) of stacked toasts that auto-dismiss and can be clicked
// away. Variants: "success" | "error" | "info". Messages are passed in already
// translated by the caller (via useT), so toasts respect the active language.
import React, { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastCtx = createContext({ toast: () => {} });
let _id = 0;

const ICONS = {
  success: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
  ),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    (message, type = "info", ms = 3500) => {
      const id = ++_id;
      setToasts((ts) => [...ts, { id, message, type }]);
      timers.current[id] = setTimeout(() => dismiss(id), ms);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="toast-viewport" role="status" aria-live="polite">
        {toasts.map((t) => (
          <button key={t.id} type="button" className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
            <span className="toast-ic">{ICONS[t.type] || ICONS.info}</span>
            <span className="toast-msg">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
