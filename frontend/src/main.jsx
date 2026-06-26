import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth";
import { LangProvider } from "./i18n";
import App from "./App.jsx";

const container = document.getElementById("root");
if (!container) throw new Error("Smart Eye: #root element not found in index.html");

createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LangProvider>
          <App />
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
