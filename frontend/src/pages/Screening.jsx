// Screening page — fundus image + symptom survey -> /api/session/score.
// Renders the Ocular Health Index gauge, per-class bars, recommendation, and a
// client-side print/export. Each scored session is persisted to History server-side.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { scoreSession, explainImage } from "../api";
import { SYMPTOMS, DISCLAIMER } from "../constants";
import { Banners, Dropzone, LikertRow, OHIGauge, ClassBars } from "../components";

export default function Screening({ isMock }) {
  const fileInputRef = useRef(null);
  const [symptoms, setSymptoms] = useState({ pain: 1, redness: 1, photophobia: 1, blurred_vision: 1 });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [gradcam, setGradcam] = useState(null);     // base64 overlay data URI
  const [explaining, setExplaining] = useState(false);

  const explain = useCallback(async () => {
    if (!imageFile) return;
    setExplaining(true);
    try {
      const data = await explainImage(imageFile);
      setGradcam(data.gradcam || null);
    } catch (e) {
      setError(`Could not generate explanation: ${e.message}`);
    } finally {
      setExplaining(false);
    }
  }, [imageFile]);

  const selectImage = useCallback((file) => {
    setImageFile(file);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const setSymptom = (key, n) => setSymptoms((p) => ({ ...p, [key]: n }));

  const run = useCallback(async () => {
    setScoring(true);
    setError(null);
    try {
      const data = await scoreSession({ file: imageFile, symptoms, fatigue: null });
      setResult(data);
      setGradcam(null);
    } catch (e) {
      setError(`Screening failed — is the backend running on :8000? (${e.message})`);
    } finally {
      setScoring(false);
    }
  }, [imageFile, symptoms]);

  return (
    <main className="se-wrap page">
      <div className="page-head">
        <span className="eyebrow">Screening</span>
        <h1 className="page-h">Disease screening &amp; Ocular Health Index</h1>
        <p className="lead">Upload a fundus image and rate your symptoms. The server fuses both into a fuzzy-logic risk score.</p>
      </div>

      <Banners isMock={isMock} error={error} />

      <div className="screen-grid">
        <section className="card">
          <div className="card-head"><span className="eyebrow">Step 1</span><h3>Screening inputs</h3></div>
          <Dropzone preview={preview} onSelect={selectImage} inputRef={fileInputRef} />
          <div className="form-sec">Symptom survey · 1 (none) – 5 (severe)</div>
          {SYMPTOMS.map((s) => (
            <LikertRow key={s.key} label={s.label} value={symptoms[s.key]} onChange={(n) => setSymptom(s.key, n)} />
          ))}
          <button className="btn btn-primary btn-run" onClick={run} disabled={scoring}>
            {scoring ? "Scoring…" : "Run screening →"}
          </button>
          <p className="muted small" style={{ marginTop: 10 }}>
            No image? You'll still get an OHI from symptoms alone — disease screening is simply skipped.
          </p>
        </section>

        <section className="card">
          {!result ? (
            <div className="result-ghost">
              <div className="ghost-ring"><span>OHI</span></div>
              <p>Run a screening to generate your Ocular Health Index, class probabilities, and triage recommendation.</p>
            </div>
          ) : (
            <div className="result-live">
              <div className="card-head">
                <span className="eyebrow">Result</span><h3>Ocular Health Index</h3>
                {typeof result.latency_ms === "number" && <span className="muted small mono">{result.latency_ms} ms</span>}
              </div>
              {result.disease?.is_mock && (
                <div className="mock-strip inline">Mock model — placeholder probabilities, not a screening result.</div>
              )}
              <div className="result-grid">
                <OHIGauge ohi={result.ohi?.ohi} band={result.ohi?.band} colour={result.ohi?.colour} />
                <div className="result-detail">
                  <div className="sub-lbl">Disease probabilities</div>
                  <ClassBars probabilities={result.disease?.probabilities} topClass={result.disease?.top_class} />
                  <div className="sub-lbl">Recommended next steps</div>
                  <ul className="actions">
                    {(result.recommendation?.actions || []).map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              </div>
              <div className="result-actions">
                <button className="btn btn-ghost" onClick={() => window.print()}>Export / print report</button>
                {imageFile && result.disease && result.disease.is_mock === false && (
                  <button className="btn btn-ghost" onClick={explain} disabled={explaining}>
                    {explaining ? "Generating…" : "Explain prediction"}
                  </button>
                )}
                {result.session_id != null && <span className="muted small">Saved to history · #{result.session_id}</span>}
              </div>
              {gradcam && (
                <div className="gradcam-panel">
                  <div className="sub-lbl">Grad-CAM — where the model looked</div>
                  <img src={gradcam} alt="Grad-CAM heatmap overlay" className="gradcam-img" />
                  <p className="muted small">
                    Warm regions show the areas of the fundus that most influenced the prediction
                    (ResNet branch). This is an explainability aid, not a diagnostic marker.
                  </p>
                </div>
              )}
              <p className="disc-foot">{result.recommendation?.disclaimer || DISCLAIMER}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
