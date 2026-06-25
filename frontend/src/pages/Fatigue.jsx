// Fatigue page — live webcam, in-browser 468-pt face mesh (MediaPipe).
// Only the 12 eye-landmark COORDINATES are POSTed to /api/fatigue/frame; the raw
// video never leaves the device. The server computes EAR, blink rate, drowsiness.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaceMesh } from "@mediapipe/face_mesh";
import { postFatigueFrame } from "../api";
import { FRAME_INTERVAL_MS, SPARK_LEN, EAR_THRESHOLD, fmtTime } from "../constants";
import { IrisVisual, Met, Sparkline } from "../components";

// MediaPipe FaceMesh eye landmark indices, ordered to match the backend EAR
// formula's expected p1..p6: [outer_corner, top1, top2, inner_corner, bottom2, bottom1].
// These indices track the eyelids tightly, so EAR drops sharply on a blink.
const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
// Backend expects a 68-pt array indexed via LEFT_EYE_IDX=(36..41), RIGHT_EYE_IDX=(42..47).
const LEFT_SLOT  = [36, 37, 38, 39, 40, 41];
const RIGHT_SLOT = [42, 43, 44, 45, 46, 47];

export default function Fatigue() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const runningRef = useRef(false);
  const processingRef = useRef(false);
  const loopTimerRef = useRef(null);
  const drowsyRef = useRef(false);
  const audioCtxRef = useRef(null);
  const meshRef = useRef(null);
  const latestLandmarksRef = useRef(null);
  const failCountRef = useRef(0);

  const [modelsReady, setModelsReady] = useState(false);
  const [camStatus, setCamStatus] = useState("idle");
  const [cameraOn, setCameraOn] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [fatigue, setFatigue] = useState(null);
  const [earHistory, setEarHistory] = useState([]);
  const [error, setError] = useState(null);

  const beep = useCallback(() => {
    try {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
  }, []);

  // Build the FaceMesh once; its onResults stashes the latest landmarks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCamStatus("loading-models");
        const mesh = new FaceMesh({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`,
        });
        mesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,   // sharper eye/iris landmarks
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        mesh.onResults((results) => {
          const faces = results.multiFaceLandmarks;
          latestLandmarksRef.current =
            faces && faces.length ? faces[0] : null;
        });
        meshRef.current = mesh;
        if (!cancelled) {
          setModelsReady(true);
          setCamStatus("idle");
        }
      } catch (e) {
        if (!cancelled) {
          setError(`Failed to load MediaPipe FaceMesh: ${e.message}`);
          setCamStatus("error");
        }
      }
    })();
    return () => { cancelled = true; stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processFrame = useCallback(async () => {
    const video = videoRef.current;
    const mesh = meshRef.current;
    if (!video || video.readyState !== 4 || !mesh) return;

    // Run the mesh on the current frame; onResults populates latestLandmarksRef.
    await mesh.send({ image: video });
    const lm = latestLandmarksRef.current;

    const canvas = canvasRef.current;
    if (!lm) {
      setFatigue((f) => ({ ...(f || {}), face_detected: false }));
      setCamStatus("face-lost");
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    setCamStatus("running");

    const dispW = video.videoWidth || 640;
    const dispH = video.videoHeight || 480;

    // Draw just the eye landmarks as glowing cyan dots.
    if (canvas) {
      if (canvas.width !== dispW) canvas.width = dispW;
      if (canvas.height !== dispH) canvas.height = dispH;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, dispW, dispH);
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 6;
      for (const idx of [...LEFT_EYE, ...RIGHT_EYE]) {
        const p = lm[idx];
        ctx.beginPath();
        ctx.arc(p.x * dispW, p.y * dispH, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Build a 68-slot array; backend only reads indices 36-47 (the two eyes).
    const pts = Array.from({ length: 68 }, () => [0, 0]);
    LEFT_EYE.forEach((mpIdx, k) => {
      pts[LEFT_SLOT[k]] = [lm[mpIdx].x * dispW, lm[mpIdx].y * dispH];
    });
    RIGHT_EYE.forEach((mpIdx, k) => {
      pts[RIGHT_SLOT[k]] = [lm[mpIdx].x * dispW, lm[mpIdx].y * dispH];
    });

    try {
      const snap = await postFatigueFrame(pts);
      setFatigue(snap);
      setEarHistory((prev) => [...prev.slice(-(SPARK_LEN - 1)), snap.ear]);
      if (snap.drowsy && !drowsyRef.current) beep();
      drowsyRef.current = !!snap.drowsy;
      if (failCountRef.current !== 0) { failCountRef.current = 0; setError(null); }
    } catch (_) {
      failCountRef.current += 1;
      if (failCountRef.current === 3) {
        setError("Lost connection to the scoring server — is the backend running on :8000? Retrying…");
      }
    }
  }, [beep]);

  const runLoop = useCallback(async () => {
    if (!runningRef.current) return;
    if (!processingRef.current) {
      processingRef.current = true;
      try { await processFrame(); } catch (_) {} finally { processingRef.current = false; }
    }
    if (runningRef.current) {
      loopTimerRef.current = setTimeout(runLoop, FRAME_INTERVAL_MS);
    }
  }, [processFrame]);

  const startCamera = useCallback(async () => {
    if (!modelsReady) {
      setError("Face mesh is still loading — try again in a moment.");
      return;
    }
    setError(null);
    setCamStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = audioCtxRef.current || (AC ? new AC() : null);
      } catch (_) {}

      runningRef.current = true;
      setSessionSeconds(0);
      setCameraOn(true);
      setCamStatus("running");
      runLoop();
    } catch (e) {
      setError(`Could not start the camera: ${e.message}`);
      setCamStatus("error");
    }
  }, [modelsReady, runLoop]);

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current);
    loopTimerRef.current = null;
    const s = streamRef.current;
    if (s) s.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    latestLandmarksRef.current = null;
    drowsyRef.current = false;
    setCameraOn(false);
    setCamStatus("idle");
  }, []);

  useEffect(() => {
    if (!cameraOn) return undefined;
    const id = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [cameraOn]);

  const hasData = !!fatigue && fatigue.face_detected !== false;
  const ear = fatigue?.ear ?? 0;
  const bpm = fatigue?.blink_rate_bpm ?? 0;
  const fatigueScore = fatigue?.fatigue_score ?? 0;
  const drowsy = !!fatigue?.drowsy;
  const running = cameraOn;
  const fatigueColor =
    fatigueScore < 34 ? "var(--success)" : fatigueScore < 67 ? "var(--warning)" : "var(--danger)";

  let statusCls = "";
  let statusTxt = modelsReady ? "idle" : "loading models";
  if (running) {
    if (camStatus === "face-lost") { statusCls = "pill-lost"; statusTxt = "no face"; }
    else { statusCls = "pill-live"; statusTxt = "live"; }
  }

  return (
    <main className="se-wrap page">
      <div className="page-head">
        <span className="eyebrow">Fatigue</span>
        <h1 className="page-h">Real-time fatigue &amp; drowsiness monitor</h1>
        <p className="lead">Webcam eye-aspect-ratio tracking with blink-rate analysis. Processing is on-device; only coordinates are sent to score EAR.</p>
      </div>

      {error && <div className="err-strip">{error}</div>}

      <section className="card cam-card-full">
        <div className="card-head">
          <span className="eyebrow">Live</span><h3>Fatigue monitor</h3>
          <span className={`pill ${statusCls}`}><span className="dot" />{statusTxt}</span>
        </div>

        <div className="cam cam-lg">
          <video ref={videoRef} className="cam-video" muted playsInline />
          <canvas ref={canvasRef} className="cam-overlay" />
          {running && <div className="rec">REC · LIVE</div>}
          {running && <div className="fps">{camStatus === "face-lost" ? "NO FACE" : "TRACKING"}</div>}
          {drowsy && <div className="drowsy">DROWSINESS ALERT</div>}
          {!running && (
            <div className="cam-idle">
              <IrisVisual />
              <div className="cam-idle-text">
                {modelsReady ? "press Start camera to begin tracking" : "loading face mesh…"}
              </div>
            </div>
          )}
        </div>

        <div className="metric-row">
          <Met label="EAR" value={hasData ? ear.toFixed(3) : "—"} accent="#7dd3fc" />
          <Met label="Blink / min" value={hasData ? bpm.toFixed(0) : "—"} />
          <Met label="Fatigue" value={hasData ? fatigueScore.toFixed(0) : "—"} accent={hasData ? fatigueColor : undefined} />
          <Met label="Session" value={fmtTime(sessionSeconds)} />
        </div>

        <Sparkline history={earHistory} threshold={EAR_THRESHOLD} />

        <div className="cam-controls">
          {!running ? (
            <button className="btn btn-primary" onClick={startCamera} disabled={!modelsReady}>
              {modelsReady ? "Start camera" : "Loading models…"}
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={stopCamera}>Stop camera</button>
          )}
        </div>

        <p className="disc-foot">
          Face detection runs entirely in your browser (MediaPipe Face Mesh). Only landmark coordinates are sent to
          the server to compute EAR — your video never leaves this device.
        </p>
      </section>
    </main>
  );
}
