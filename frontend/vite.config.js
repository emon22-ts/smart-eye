import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev-server configuration for the Smart Eye frontend.
//
// The proxy block forwards every request beginning with /api straight to the
// FastAPI backend on port 8000, so the browser sees a single same-origin host
// (http://localhost:5173) and never triggers a CORS preflight in development.
// Because the backend routes are already namespaced under /api, no path rewrite
// is needed — /api/session/score -> http://localhost:8000/api/session/score.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // ws: true,  // uncomment if you later add a WebSocket fatigue stream
      },
    },
  },
});
