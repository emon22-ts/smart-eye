// Screening page — fundus image + symptom survey -> /api/session/score.
// Renders the Ocular Health Index gauge, per-class bars, recommendation, and a
// client-side print/export. Each scored session is persisted to History server-side.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { scoreSession, explainImage } from "../api";
import { SYMPTOMS, DISCLAIMER, COLOURS } from "../constants";
import { Banners, Dropzone, LikertRow, OHIGauge, ClassBars, WebcamCapture } from "../components";
import { useT } from "../i18n";

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
  const { t } = useT();
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
          top: (r.disease?.top_class || "\u2014").replace(/_/g, " "),
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
      <div className="card-head"><span className="eyebrow">{t("batch.eyebrow")}</span><h3>{t("batch.title")}</h3></div>
      <p className="muted small" style={{ marginBottom: 14 }}>
        {t("batch.intro")}
      </p>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={pick} />
      <div className="batch-controls">
        <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()} disabled={running}>
          {files.length ? `${files.length} ${t("batch.imagesSelected")}` : t("batch.select")}
        </button>
        <button type="button" className="btn btn-primary" onClick={runAll} disabled={running || !files.length}>
          {running ? `${progress}/${files.length}\u2026` : t("batch.screenAll")}
        </button>
      </div>
      {results.length > 0 && (
        <div className="batch-table">
          <div className="batch-head">
            <span>{t("batch.colFile")}</span><span>{t("batch.colOhi")}</span><span>{t("batch.colRisk")}</span><span>{t("batch.colTop")}</span><span>{t("batch.colConf")}</span>
          </div>
          {results.map((r, i) => (
            <div className="batch-row" key={i}>
              <span className="batch-file" title={r.name}>{r.name}</span>
              {r.error ? (
                <span className="batch-err" style={{ gridColumn: "2 / 6" }}>{t("batch.failed")}: {r.error}</span>
              ) : (
                <>
                  <span className="mono" style={{ color: COLOURS[r.colour] || "var(--fg)" }}>
                    {r.ohi == null ? "\u2014" : Math.round(r.ohi)}
                  </span>
                  <span className="batch-band">{r.band || "\u2014"}</span>
                  <span className="batch-top">{r.top}{r.mock && <span className="mock-tag">mock</span>}</span>
                  <span className="mono small">{r.conf == null ? "\u2014" : `${(r.conf * 100).toFixed(0)}%`}</span>
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
  const { t } = useT();
  const fileInputRef = useRef(null);
  const [symptoms, setSymptoms] = useState({ pain: 1, redness: 1, photophobia: 1, blurred_vision: 1 });
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [gradcam, setGradcam] = useState(null);     // base64 overlay data URI
  const [explaining, setExplaining] = useState(false);
  const [gradcamClass, setGradcamClass] = useState(null);
  const [fundusWarn, setFundusWarn] = useState(null);
  const [ackNonFundus, setAckNonFundus] = useState(false);
  const [imgWarning, setImgWarning] = useState(false); // image does not look like a fundus photo

  const explain = useCallback(async (className) => {
    if (!imageFile) return;
    setExplaining(true);
    try {
      const data = await explainImage(imageFile, className);
      setGradcam(data.gradcam || null);
      setGradcamClass(data.gradcam_class || null);
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
        <span className="eyebrow">{t("screen.eyebrow")}</span>
        <h1 className="page-h">{t("screen.title")}</h1>
        <p className="lead">{t("screen.lead")}</p>
      </div>

      <Banners isMock={isMock} error={error} />

      <div className="screen-grid">
        <section className="card">
          <div className="card-head"><span className="eyebrow">{t("screen.step1")}</span><h3>{t("screen.inputs")}</h3></div>
          <Dropzone preview={preview} onSelect={selectImage} inputRef={fileInputRef} />
          <WebcamCapture onCapture={selectImage} />
          <div className="form-sec">{t("screen.symptomSurvey")}</div>
          {SYMPTOMS.map((s) => (
            <LikertRow key={s.key} label={t(`symptom.${s.key}`)} value={symptoms[s.key]} onChange={(n) => setSymptom(s.key, n)} />
          ))}
          {fundusWarn && (
            <div className="fundus-warn">
              <p>{fundusWarn}</p>
              <label className="fundus-ack">
                <input type="checkbox" checked={ackNonFundus} onChange={(e) => setAckNonFundus(e.target.checked)} />
                <span>{t("screen.fundusAck")}</span>
              </label>
            </div>
          )}
          <button className="btn btn-primary btn-run" onClick={run} disabled={scoring || (!!fundusWarn && !ackNonFundus)}>
            {scoring ? t("screen.scoring") : t("screen.runArrow")}
          </button>
          <p className="muted small" style={{ marginTop: 10 }}>
            {t("screen.noImageHint")}
          </p>
        </section>

        <section className="card">
          {!result ? (
            <div className="result-ghost">
              <div className="ghost-ring"><span>OHI</span></div>
              <p>{t("screen.ghostText")}</p>
            </div>
          ) : (
            <div className="result-live">
              <div className="card-head">
                <span className="eyebrow">{t("screen.resultEyebrow")}</span><h3>{t("screen.resultTitle")}</h3>
                {typeof result.latency_ms === "number" && <span className="muted small mono">{result.latency_ms} ms</span>}
              </div>
              {result.disease?.is_mock && (
                <div className="mock-strip inline">{t("screen.mockStrip")}</div>
              )}
              <div className="result-grid">
                <OHIGauge ohi={result.ohi?.ohi} band={result.ohi?.band} colour={result.ohi?.colour} />
                <div className="result-detail">
                  <div className="sub-lbl">{t("screen.diseaseProbs")}</div>
                  <ClassBars probabilities={result.disease?.probabilities} topClass={result.disease?.top_class} />
                  {showLowConf && (
                    <div className="lowconf-note">
                      ⚠ {t("screen.lowConf")} ({(topConf * 100).toFixed(0)}%). {t("screen.lowConfTail")}
                    </div>
                  )}
                  <div className="sub-lbl">{t("screen.recSteps")}</div>
                  <ul className="actions">
                    {(result.recommendation?.actions || []).map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              </div>
              <div className="result-actions">
                <button className="btn btn-ghost" onClick={() => window.print()}>{t("screen.export")}</button>
                {imageFile && result.disease && result.disease.is_mock === false && (
                  <button className="btn btn-ghost" onClick={() => explain()} disabled={explaining}>
                    {explaining ? t("screen.generating") : t("screen.explain")}
                  </button>
                )}
                {result.session_id != null
                  ? <span className="muted small">{t("screen.savedHist")} · #{result.session_id}</span>
                  : <span className="muted small">{t("screen.signInSave")}</span>}
              </div>
              {gradcam && (
                <div className="gradcam-panel">
                  <div className="sub-lbl">{t("screen.gradcamTitle")}</div>
                  {result.disease?.probabilities && (
                    <div className="gradcam-classes">
                      {Object.keys(result.disease.probabilities).map((cls) => (
                        <button
                          key={cls}
                          type="button"
                          className={`gc-class ${gradcamClass === cls ? "on" : ""}`}
                          onClick={() => explain(cls)}
                          disabled={explaining}
                        >
                          {t(`class.${cls}`)}
                        </button>
                      ))}
                    </div>
                  )}
                  <img src={gradcam} alt="Grad-CAM heatmap overlay" className="gradcam-img" />
                  <p className="muted small">
                    {gradcamClass ? `${t("screen.showing")}: ${t(`class.${gradcamClass}`)}. ` : ""}{t("screen.gradcamCaption")}
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
