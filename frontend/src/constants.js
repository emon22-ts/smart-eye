// Shared constants for the Smart Eye frontend.
export const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
export const FRAME_INTERVAL_MS = 120; // ~8 Hz landmark detection + POST
export const SPARK_LEN = 60;
export const EAR_THRESHOLD = 0.25;
export const COLOURS = { green: "#22C55E", amber: "#F59E0B", red: "#EF4444" };
export const DISCLAIMER =
  "Smart Eye is a preliminary screening and triage support utility. It does " +
  "NOT provide a clinical diagnosis. Final medical conclusions remain entirely " +
  "the responsibility of qualified healthcare professionals.";
export const SYMPTOMS = [
  { key: "pain", label: "Eye pain" },
  { key: "redness", label: "Redness" },
  { key: "photophobia", label: "Light sensitivity" },
  { key: "blurred_vision", label: "Blurred vision" },
];
export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};
