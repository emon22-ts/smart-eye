// Screening page — fundus image + symptom survey -> /api/session/score.
// Renders the Ocular Health Index gauge, per-class bars, recommendation, and a
// client-side print/export. Each scored session is persisted to History server-side.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { scoreSession, explainImage } from "../api";
import { SYMPTOMS, DISCLAIMER, COLOURS } from "../constants";
import { Banners, Dropzone, LikertRow, OHIGauge, ClassBars, WebcamCapture } from "../components";

// Lightweight client-side guard: does this image plausibly look like a retinal
// fundus photograph? Fundus images are strongly red-dominant (the retina) and
// usually sit in a circular field with dark corners. This is a heuristic to catch
// obvious misuse (e.g. a face or eye selfie), not a definitive detector.
async function looksLikeFundus(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const W = 100, H = 100;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let rSum = 0, gSum = 0, bSum = 0, n = 0, cornerLum = 0, cornerN = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const r = d[idx], g = d[idx + 1], b = d[idx + 2];
        rSum += r; gSum += g; bSum += b; n++;
        if ((x < 15 || x >= W - 15) && (y < 15 || y >= H - 15)) {
          cornerLum += 0.299 * r + 0.587 * g + 0.114 * b;
          cornerN++;
        }
      }
    }
    const mR = rSum / n, mG = gSum / n, mB = bSum / n;
    const cornerDark = cornerLum / cornerN < 70;
    const redDominant = mR > mB * 1.4 && mR >= mG;
    return redDominant && (cornerDark || mR > mB * 2.2);
  } catch {
    return true; // fail open: if we cannot analyse it, do not block
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Batch screening: score several fundus images in one go. Each image is scored on
// the image alone (symptoms neutral) via the existing endpoint and saved to history.
// Runs sequentially to stay gentle on the model; no backend change is required.
function BatchScreen() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const pick = (e) => {
    const list = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    setFiles(list);
    setResults([]);
  };

  const runAll = async () => {
    if (!files.length) return;
    setRunning(true);
    setResults([]);
    setProgress(0);
    const out = [];
    const neutral = { pain: 1, redness: 1, photophobia: 1, blurred_vision: 1 };
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const r = await scoreSession({ file: f, symptoms: neutral, fatigue: null });
        out.push({
          name: f.name,
          ohi: r.ohi?.ohi,
          band: r.ohi?.band,
          colour: r.ohi?.colour,
          top: (r.disease?.top_class || "—").replace(/_/g, " "),
          conf: r.disease?.probabilities ? Math.max(...Object.values(r.disease.probabilities)) : null,
          mock: !!r.disease?.is_mock,
        });
      } catch (e) {
        out.push({ name: f.name, error: e.message });
      }
      setProgress(i + 1);
      setResults([...out]);
    }
    setRunning(false);
  };

  return (
    <section className="card batch-card">
      <div className="card-head"><span className="eyebrow">Batch</span><h3>Batch screening</h3></div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Screen several fundus images at once. Each is scored on the image alone (symptoms neutral) and saved to history.
      </p>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={pick} />
      <div className="batch-controls">
        <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()} disabled={running}>
          {files.length ? `${files.length} image${files.length > 1 ? "s" : ""} selected` : "Select fundus images"}
        </button>
        <button type="button" className="btn btn-primary" onClick={runAll} disabled={running || !files.length}>
          {running ? `Screening ${progress}/${files.length}…` : "Screen all"}
        </button>
      </div>
      {results.length > 0 && (
        <div className="batch-table">
          <div className="batch-head">
            <span>File</span><span>OHI</span><span>Risk</span><span>Top finding</span><span>Conf.</span>
          </div>
          {results.map((r, i) => (
            <div className="batch-row" key={i}>
              <span className="batch-file" title={r.name}>{r.name}</span>
              {r.error ? (
                <span className="batch-err" style={{ gridColumn: "2 / 6" }}>Failed: {r.error}</span>
              ) : (
                <>
                  <span className="mono" style={{ color: COLOURS[r.colour] || "var(--fg)" }}>
                    {r.ohi == null ? "—" : Math.round(r.ohi)}
                  </span>
                  <span className="batch-band">{r.band || "—"}</span>
                  <span className="batch-top">{r.top}{r.mock && <span className="mock-tag">mock</span>}</span>
                  <span className="mono small">{r.conf == null ? "—" : `${(r.conf * 100).toFixed(0)}%`}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
  const [fundusWarn, setFundusWarn] = useState(null);
  const [ackNonFundus, setAckNonFundus] = useState(false);

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
    setFundusWarn(null);
    setAckNonFundus(false);
    looksLikeFundus(file).then((ok) => {
      if (!ok) {
        setFundusWarn(
          "This does not look like a retinal fundus image. Smart Eye only analyses fundus photographs; running it on other images (such as a face or eye selfie) produces a confident-looking but meaningless result."
        );
      }
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

  // Low-confidence guard: if the top class probability is weak, flag the result
  // as uncertain rather than presenting a shaky guess as a screening outcome.
  const _probs = result?.disease?.probabilities;
  const topConf =
    _probs && !result?.disease?.is_mock ? Math.max(...Object.values(_probs)) : null;
  const showLowConf = topConf != null && topConf < 0.5;

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
          <WebcamCapture onCapture={selectImage} />
          <div className="form-sec">Symptom survey · 1 (none) – 5 (severe)</div>
          {SYMPTOMS.map((s) => (
            <LikertRow key={s.key} label={s.label} value={symptoms[s.key]} onChange={(n) => setSymptom(s.key, n)} />
          ))}
          {fundusWarn && (
            <div className="fundus-warn">
              <p>{fundusWarn}</p>
              <label className="fundus-ack">
                <input type="checkbox" checked={ackNonFundus} onChange={(e) => setAckNonFundus(e.target.checked)} />
                <span>I understand. Screen this image anyway.</span>
              </label>
            </div>
          )}
          <button className="btn btn-primary btn-run" onClick={run} disabled={scoring || (!!fundusWarn && !ackNonFundus)}>
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
                  {showLowConf && (
                    <div className="lowconf-note">
                      ⚠ Low model confidence ({(topConf * 100).toFixed(0)}%). This result is uncertain — treat it with extra caution and prioritise professional review.
                    </div>
                  )}
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

      <BatchScreen />
    </main>
  );
}
