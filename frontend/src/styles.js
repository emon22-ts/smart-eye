// Smart Eye — Concept C design language (scoped under .se-app), shared by all pages.
export const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#060A12; --bg-2:#0B1220; --card:#111827; --card-2:#0E1626;
  --primary:#3B82F6; --primary-600:#2563EB; --accent:#06B6D4;
  --success:#22C55E; --warning:#F59E0B; --danger:#EF4444;
  --fg:#F8FAFC; --muted:#94A3B8; --muted-2:#64748B; --border:#1E2A44; --border-2:#334155;
  --mono:'JetBrains Mono',ui-monospace,monospace;
}
.se-app *{box-sizing:border-box;margin:0;padding:0}
.se-app{font-family:'Sora',system-ui,sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;
  -webkit-font-smoothing:antialiased;line-height:1.5;position:relative;overflow-x:hidden}
.se-wrap{max-width:1180px;margin:0 auto;padding:0 28px}

.backdrop{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.orb{position:absolute;border-radius:50%;filter:blur(80px)}
.orb.a{width:600px;height:600px;background:radial-gradient(circle,#1d4ed8,transparent 70%);top:-180px;right:-120px;opacity:.5}
.orb.b{width:480px;height:480px;background:radial-gradient(circle,#06b6d4,transparent 70%);top:260px;left:-160px;opacity:.28}
.orb.c{width:440px;height:440px;background:radial-gradient(circle,#0ea5e9,transparent 70%);bottom:-120px;right:14%;opacity:.18}
.grid-lines{position:absolute;inset:0;
  background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);
  background-size:64px 64px;opacity:.15;mask-image:radial-gradient(ellipse 80% 60% at 50% 30%,#000 30%,transparent 78%)}
.vignette{position:absolute;inset:0;background:radial-gradient(ellipse 90% 80% at 50% -10%,rgba(59,130,246,.10),transparent 60%)}

.se-nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(16px);background:rgba(6,10,18,.72);border-bottom:1px solid var(--border)}
.nav-in{height:68px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:12px;font-weight:600;letter-spacing:-.02em;text-decoration:none;color:var(--fg)}
.logo{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg,#3B82F6,#06B6D4);box-shadow:0 6px 18px rgba(59,130,246,.4)}
.logo svg{width:19px;height:19px}
.brand b{font-size:16px;display:block}
.brand .tag{font-size:9.5px;letter-spacing:.22em;color:var(--muted);text-transform:uppercase;font-weight:500;margin-top:1px;display:block}
.nav-status{display:flex;gap:10px;align-items:center}

.nav-links{display:flex;gap:4px;align-items:center;margin:0 auto 0 38px}
.nav-links a{font-size:13.5px;font-weight:500;color:var(--muted);text-decoration:none;padding:8px 14px;border-radius:9px;transition:.15s;letter-spacing:-.01em}
.nav-links a:hover{color:var(--fg);background:rgba(255,255,255,.04)}
.nav-links a.active{color:#fff;background:rgba(59,130,246,.14)}

.pill{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:500;padding:6px 13px;border-radius:999px;border:1px solid var(--border-2);background:rgba(255,255,255,.03);color:var(--muted)}
.pill .dot{width:6px;height:6px;border-radius:50%;background:var(--muted-2)}
.pill .dot-cyan{background:var(--accent);box-shadow:0 0 10px var(--accent)}
.pill-mono{font-family:var(--mono)}
.pill-ok{color:#86efac;border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.1)}
.pill-ok .dot{background:var(--success);box-shadow:0 0 10px var(--success)}
.pill-warn{color:#fcd34d;border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.1)}
.pill-warn .dot{background:var(--warning);box-shadow:0 0 10px var(--warning)}
.pill-live{color:#7dd3fc;border-color:rgba(6,182,212,.3);background:rgba(6,182,212,.1)}
.pill-live .dot{background:var(--accent);box-shadow:0 0 10px var(--accent)}
.pill-lost{color:#fca5a5;border-color:rgba(239,68,68,.3);background:rgba(239,68,68,.1)}
.pill-lost .dot{background:var(--danger)}

.mock-strip{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:10px 16px;border-radius:10px;font-weight:600;font-size:13px;text-align:center;margin-bottom:10px}
.mock-strip.inline{margin-bottom:14px;font-weight:500;text-align:left}
.lowconf-note{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#fcd34d;padding:9px 13px;border-radius:9px;font-size:12px;font-weight:500;line-height:1.45;margin-top:10px}
.cmp-selects{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.cmp-selects select{flex:1;min-width:150px;font-family:inherit;font-size:13px;color:var(--fg);background:var(--card-2);border:1px solid var(--border-2);border-radius:9px;padding:9px 11px;cursor:pointer}
.cmp-vs{font-size:11px;color:var(--muted-2);font-weight:600;text-transform:uppercase;letter-spacing:.1em}
.cmp-grid{display:flex;flex-direction:column;gap:2px}
.cmp-line{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(30,42,68,.5)}
.cmp-line:last-child{border-bottom:none}
.cmp-a{text-align:right;font-weight:600;font-size:14px;text-transform:capitalize}
.cmp-b{text-align:left;font-weight:600;font-size:14px;text-transform:capitalize}
.cmp-lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted-2);text-align:center}
.cmp-foot{margin-top:12px;text-align:center}
.cam-capture-btn{width:100%;margin-top:10px}
.capture-panel{margin-top:12px}
.capture-cam{position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--border-2);background:#0a0f1c;aspect-ratio:4/3}
.capture-video{width:100%;height:100%;object-fit:cover;display:block}
.capture-controls{display:flex;gap:10px;margin-top:10px}
.capture-controls .btn{flex:1}
.fundus-warn{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:10px;padding:12px 14px;margin-top:16px}
.fundus-warn p{font-size:12.5px;color:#fca5a5;line-height:1.5;font-weight:500}
.fundus-ack{display:flex;align-items:center;gap:9px;margin-top:10px;cursor:pointer;font-size:12.5px;color:var(--muted)}
.fundus-ack input{width:16px;height:16px;cursor:pointer;accent-color:var(--primary)}
.batch-card{margin-top:18px}
.batch-controls{display:flex;gap:10px;flex-wrap:wrap}
.batch-controls .btn{flex:1;min-width:160px}
.batch-table{margin-top:16px;display:flex;flex-direction:column}
.batch-head,.batch-row{display:grid;grid-template-columns:2fr .7fr 1fr 1.6fr .7fr;gap:12px;align-items:center;padding:9px 12px}
.batch-head{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted-2);border-bottom:1px solid var(--border)}
.batch-row{border-bottom:1px solid rgba(30,42,68,.4);font-size:13px}
.batch-row:last-child{border-bottom:none}
.batch-file{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)}
.batch-band{text-transform:capitalize}
.batch-top{text-transform:capitalize;display:flex;align-items:center;gap:6px}
.batch-err{color:var(--danger);font-size:12px}
@media(max-width:680px){.batch-head{display:none}.batch-row{grid-template-columns:1fr 1fr;gap:6px 12px}}
.gradcam-classes{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.lang-switch{font-family:inherit;font-size:12px;font-weight:600;min-width:46px;padding:7px 11px;border-radius:9px;border:1px solid var(--border-2);background:var(--card-2);color:var(--muted);cursor:pointer;transition:.15s;white-space:nowrap}
.lang-switch:hover{color:var(--fg);border-color:var(--primary)}
.gc-class{font-family:inherit;font-size:11.5px;font-weight:500;padding:6px 11px;border-radius:8px;border:1px solid var(--border-2);background:var(--card-2);color:var(--muted);cursor:pointer;transition:.15s;text-transform:capitalize}
.gc-class:hover:not(:disabled){color:var(--fg);border-color:var(--primary)}
.gc-class.on{background:rgba(59,130,246,.14);color:#fff;border-color:var(--primary)}
.gc-class:disabled{opacity:.5;cursor:default}
.err-strip{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#fca5a5;padding:9px 16px;border-radius:10px;font-size:13px;margin-bottom:10px}
.disc-in{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.25);border-radius:12px;padding:14px 18px;display:flex;gap:14px;align-items:flex-start;margin-bottom:18px}
.disc-in .ic{width:30px;height:30px;border-radius:9px;background:rgba(245,158,11,.14);display:grid;place-items:center;flex-shrink:0}
.disc-in .ic svg{width:17px;height:17px;stroke:var(--warning)}
.disc-in p{font-size:12.5px;color:#cbd5e1;line-height:1.55}
.disc-in p b{color:var(--warning);font-weight:600}

.card{background:linear-gradient(180deg,rgba(17,24,39,.72),rgba(14,22,38,.6));border:1px solid var(--border);border-radius:16px;padding:18px}
.card-head{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.card-head .eyebrow{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:600}
.card-head h3{font-size:16px;font-weight:600;letter-spacing:-.01em;margin-right:auto}

.cam{position:relative;aspect-ratio:16/10;border-radius:12px;overflow:hidden;border:1px solid var(--border-2);
  background:radial-gradient(ellipse at 50% 40%,#1e293b,#0a0f1c)}
.cam-video{width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)}
.cam-overlay{position:absolute;inset:0;width:100%;height:100%;transform:scaleX(-1);pointer-events:none}
.rec{position:absolute;top:12px;left:12px;font-family:var(--mono);font-size:10px;color:#fca5a5;display:flex;align-items:center;gap:6px;z-index:2}
.rec::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--danger);animation:se-blink 1.4s infinite}
@keyframes se-blink{50%{opacity:.2}}
.fps{position:absolute;top:12px;right:12px;font-family:var(--mono);font-size:10px;color:var(--success);z-index:2}
.drowsy{position:absolute;inset:0;display:grid;place-items:center;background:rgba(239,68,68,.3);color:#fff;font-weight:700;font-size:20px;letter-spacing:1px;z-index:3;animation:se-flash .7s steps(2,start) infinite}
@keyframes se-flash{50%{background:rgba(239,68,68,.05)}}

.metric-row{display:flex;gap:10px;margin-top:14px}
.met{flex:1;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 11px}
.met-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted-2)}
.met-v{font-family:var(--mono);font-size:17px;font-weight:500;margin-top:4px}
.spark{width:100%;height:46px;display:block;margin-top:12px}
@media(max-width:560px){.metric-row{flex-wrap:wrap}.metric-row .met{flex:1 1 calc(50% - 5px)}}

.btn{font-family:inherit;font-size:14px;font-weight:500;border:none;cursor:pointer;border-radius:10px;padding:11px 18px;
  transition:.2s;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.btn-primary{background:linear-gradient(135deg,#3B82F6,#2563EB);color:#fff;box-shadow:0 6px 20px rgba(59,130,246,.32)}
.btn-primary:hover{filter:brightness(1.07);transform:translateY(-1px)}
.btn-primary:disabled{background:#334155;box-shadow:none;cursor:not-allowed;transform:none;filter:none}
.btn-ghost{background:rgba(255,255,255,.04);color:var(--fg);border:1px solid var(--border-2)}
.btn-ghost:hover{background:rgba(255,255,255,.08)}
.cam-controls{margin-top:14px}
.cam-controls .btn{width:100%}
.btn-run{width:100%;margin-top:16px}

.dropzone{border:1.5px dashed var(--border-2);border-radius:12px;padding:18px;text-align:center;cursor:pointer;
  background:var(--card-2);min-height:150px;display:grid;place-items:center;transition:.18s}
.dropzone:hover,.dropzone.drag{border-color:var(--primary);background:rgba(59,130,246,.06)}
.dropzone.has{padding:8px}
.dz-empty{color:var(--muted)}
.dz-ic{font-size:26px;color:var(--muted-2);margin-bottom:8px}
.preview-img{max-width:100%;max-height:210px;border-radius:8px;display:block;margin:0 auto}

.form-sec{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted-2);margin:18px 0 10px}
.likert{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:9px 0}
.likert-label{font-size:13.5px}
.likert-btns{display:flex;gap:6px}
.likert-btn{width:34px;height:34px;border-radius:8px;border:1px solid var(--border-2);background:var(--card-2);
  color:var(--fg);font-family:var(--mono);font-weight:500;cursor:pointer;transition:.12s}
.likert-btn:hover{border-color:var(--primary)}
.likert-btn.on{background:linear-gradient(135deg,#3B82F6,#2563EB);border-color:transparent;color:#fff}

.result-grid{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:start}
@media(max-width:560px){.result-grid{grid-template-columns:1fr;justify-items:center}}
.gauge{display:flex;flex-direction:column;align-items:center;gap:10px}
.risk-badge{font-size:12px;font-weight:600;padding:4px 14px;border-radius:999px;border:1px solid;text-transform:capitalize}
.result-detail{width:100%}
.sub-lbl{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted-2);margin:0 0 10px}
.sub-lbl:not(:first-child){margin-top:18px}
.preds{display:flex;flex-direction:column;gap:9px}
.pred{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:11px 13px}
.pred-top{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;margin-bottom:7px}
.pred-top b{font-weight:500;text-transform:capitalize}
.mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.bar{height:6px;border-radius:3px;background:#1e293b;overflow:hidden}
.bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#3B82F6,#22d3ee);transition:width .5s ease}
.actions{margin:0;padding-left:18px;line-height:1.7;font-size:13.5px;color:#cbd5e1}
.disc-foot{margin-top:16px;padding-top:12px;border-top:1px solid var(--border);color:var(--muted-2);font-size:11.5px;line-height:1.5}

.se-footer{position:relative;z-index:1;border-top:1px solid var(--border);margin-top:20px}
.foot-in{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 0;font-size:12px;color:var(--muted-2);flex-wrap:wrap}

.muted{color:var(--muted)}
.muted-2{color:var(--muted-2)}
.small{font-size:11.5px;font-weight:400}

/* ===== Hero typography (shared) ===== */
.hero{position:relative;z-index:1}
.hero-pill{margin-bottom:18px}
.hero-h{font-size:56px;line-height:1.02;letter-spacing:-.035em;font-weight:600}
.hero-h .eye-grad{background:linear-gradient(135deg,#60A5FA,#22D3EE);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-sub{font-size:18px;color:#cbd5e1;font-weight:400;margin-top:14px;letter-spacing:-.01em}
.trust{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:22px;padding-top:20px;border-top:1px solid var(--border)}
.trust span{font-size:12px;color:var(--muted-2);display:flex;align-items:center;gap:9px}
.trust span::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--accent)}
@media(max-width:560px){.hero-h{font-size:38px}}

/* ===== Camera-idle animated iris (Concept C signature) ===== */
.cam-idle{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:1}
.cam-idle-text{font-size:12px;color:var(--muted-2);font-family:var(--mono);letter-spacing:.04em;text-transform:uppercase}
.iris-stage{position:relative;width:300px;height:300px;display:grid;place-items:center}
.iris{position:relative;width:208px;height:208px;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,#020617 16%,transparent 17%),conic-gradient(from 0deg,#0ea5e9,#3B82F6,#22d3ee,#2563eb,#06b6d4,#3B82F6,#0ea5e9);
  box-shadow:0 0 70px rgba(34,211,238,.3),inset 0 0 50px rgba(2,6,23,.9);animation:se-spin 18s linear infinite}
.pupil{position:absolute;width:66px;height:66px;border-radius:50%;background:#020617;
  box-shadow:0 0 26px rgba(34,211,238,.5),inset 0 0 16px rgba(34,211,238,.25);z-index:2}
.pupil::after{content:'';position:absolute;top:15px;left:18px;width:15px;height:15px;border-radius:50%;
  background:radial-gradient(circle,#e0f2fe,transparent 70%);opacity:.8}
@keyframes se-spin{to{transform:rotate(360deg)}}
.ring{position:absolute;border-radius:50%;border:1px solid rgba(59,130,246,.2)}
.ring.r1{width:260px;height:260px;animation:se-spin 30s linear infinite reverse}
.ring.r1::before{content:'';position:absolute;top:-3px;left:50%;width:6px;height:6px;border-radius:50%;
  background:var(--accent);box-shadow:0 0 12px var(--accent);transform:translateX(-50%)}
.ring.r2{width:300px;height:300px;border-style:dashed;border-color:rgba(148,163,184,.12)}
.scan{position:absolute;width:208px;height:208px;border-radius:50%;overflow:hidden;z-index:1}
.scan::before{content:'';position:absolute;left:0;right:0;height:40%;
  background:linear-gradient(to bottom,transparent,rgba(34,211,238,.18),transparent);animation:se-scan 3.5s ease-in-out infinite}
@keyframes se-scan{0%,100%{top:-40%}50%{top:100%}}

/* ===== Ghosted result preview ===== */
.result-ghost{display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px;padding:32px 22px}
.ghost-ring{width:116px;height:116px;border-radius:50%;display:grid;place-items:center;font-family:var(--mono);
  font-size:12px;letter-spacing:.14em;color:var(--muted-2);
  background:conic-gradient(from -90deg,rgba(59,130,246,.55),rgba(34,211,238,.12) 45%,#1e293b 45%);
  -webkit-mask:radial-gradient(circle 47px at 50% 50%,#0000 46px,#000 47px);
          mask:radial-gradient(circle 47px at 50% 50%,#0000 46px,#000 47px)}
.result-ghost p{font-size:13px;color:var(--muted);max-width:300px;line-height:1.6}

/* =====================================================================
   Multi-page additions
   ===================================================================== */
.page{position:relative;z-index:1;padding-bottom:32px}
.page-head{padding:32px 0 20px}
.page-head .eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:600;display:block;margin-bottom:10px}
.page-h{font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1.1}
.lead{font-size:14.5px;color:var(--muted);margin-top:12px;max-width:680px;line-height:1.6}
@media(max-width:560px){.page-h{font-size:23px}}

/* Home hero (two-column) */
.hero-home{display:grid;grid-template-columns:1.15fr .85fr;gap:30px;align-items:center;max-width:none;margin:0;padding:52px 0 30px}
.hero-copy{min-width:0}
.hero-desc{font-size:15px;color:var(--muted);line-height:1.7;margin-top:18px;max-width:560px}
.hero-btns{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}
.btn-lg{padding:13px 24px;font-size:15px}
.hero-visual{display:grid;place-items:center}
@media(max-width:880px){.hero-home{grid-template-columns:1fr}.hero-visual{display:none}}

/* Feature grid */
.features{position:relative;z-index:1;padding:44px 0 8px}
.features .eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:600}
.h2{font-size:30px;font-weight:600;letter-spacing:-.025em;margin-top:12px;line-height:1.12}
.features .lead{margin-bottom:30px}
.feat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:880px){.feat-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.feat-grid{grid-template-columns:1fr}}
.fcard{background:linear-gradient(180deg,rgba(17,24,39,.72),rgba(14,22,38,.6));border:1px solid var(--border);border-radius:16px;padding:22px;transition:.2s}
.fcard:hover{border-color:var(--border-2);transform:translateY(-2px)}
.fcard .ic{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);margin-bottom:15px}
.fcard .ic svg{width:21px;height:21px}
.fcard h3{font-size:15.5px;font-weight:600;letter-spacing:-.01em;margin-bottom:8px}
.fcard p{font-size:13px;color:var(--muted);line-height:1.6}

/* Screening page */
.screen-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:18px;align-items:start}
@media(max-width:900px){.screen-grid{grid-template-columns:1fr}}
.result-actions{display:flex;align-items:center;gap:14px;margin-top:18px;flex-wrap:wrap}

/* Fatigue page large camera */
.cam-card-full{max-width:780px;margin:0 auto}
.cam-lg{aspect-ratio:16/9}

/* History table */
.hist{display:flex;flex-direction:column;gap:2px}
.hist-head,.hist-row{display:grid;grid-template-columns:1.6fr .6fr .9fr 1.5fr .7fr 44px;gap:12px;align-items:center}
.hist-head-6,.hist-row-6{display:grid;grid-template-columns:1.6fr .55fr .85fr 1.4fr .65fr .7fr 44px;gap:12px;align-items:center}
.hist-head{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted-2);padding:0 12px 10px;border-bottom:1px solid var(--border)}
.hist-row{padding:13px 12px;border-bottom:1px solid rgba(30,42,68,.5);font-size:13.5px}
.hist-row:hover{background:rgba(255,255,255,.02)}
.hist-top{display:flex;align-items:center;gap:8px;text-transform:capitalize}
.risk-badge.sm{font-size:10.5px;padding:3px 10px}
.mock-tag{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#fca5a5;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.1);padding:1px 6px;border-radius:5px;font-weight:600}
.btn-icon{width:28px;height:28px;border-radius:7px;border:1px solid var(--border-2);background:transparent;color:var(--muted-2);cursor:pointer;font-size:12px;transition:.15s}
.btn-icon:hover{color:#fca5a5;border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.08)}
@media(max-width:680px){.hist-head,.hist-head-6{display:none}.hist-row,.hist-row-6{grid-template-columns:1fr 1fr;gap:6px 12px}}

/* Responsive nav */
@media(max-width:760px){.nav-links{margin-left:14px;gap:0}.nav-links a{padding:8px 9px;font-size:12.5px}.brand .tag{display:none}}
/* ---- Hamburger menu (mobile nav) ---- */
.nav-burger{display:none;background:none;border:0;cursor:pointer;padding:10px;margin-left:auto}
.burger-bars,.burger-bars::before,.burger-bars::after{display:block;width:22px;height:2px;background:var(--fg);border-radius:2px;transition:transform .2s,opacity .2s;content:""}
.burger-bars{position:relative}
.burger-bars::before{position:absolute;top:-7px}
.burger-bars::after{position:absolute;top:7px}
.burger-bars.open{background:transparent}
.burger-bars.open::before{transform:translateY(7px) rotate(45deg)}
.burger-bars.open::after{transform:translateY(-7px) rotate(-45deg)}
.nav-mobile{display:none}
@media(max-width:760px){
  .nav-burger{display:block}
  .nav-links,.nav-status{display:none}
  .nav-mobile{display:flex;flex-direction:column;gap:2px;padding:10px 16px 16px;border-top:1px solid var(--border);background:rgba(6,10,18,.96);backdrop-filter:blur(16px)}
  .nav-mobile a{font-size:15px;font-weight:500;color:var(--muted);text-decoration:none;padding:13px 12px;border-radius:10px}
  .nav-mobile a.active{color:#fff;background:rgba(59,130,246,.14)}
  .nav-mobile-foot{display:flex;align-items:center;gap:12px;margin-top:8px;padding:12px 12px 0;border-top:1px solid var(--border)}
}
.theme-light .nav-mobile{background:rgba(255,255,255,.97)}
.theme-light .nav-mobile a.active{background:rgba(59,130,246,.12);color:var(--primary)}

/* ============ Polish layer: animations, hover, skeletons, mobile ============ */
/* Entrance animations */
@keyframes se-fade-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes se-fade-in{from{opacity:0}to{opacity:1}}
@keyframes se-pop{0%{opacity:0;transform:scale(.94)}60%{transform:scale(1.01)}100%{opacity:1;transform:scale(1)}}
@keyframes se-shimmer{0%{background-position:-468px 0}100%{background-position:468px 0}}

.anim-up{animation:se-fade-up .5s cubic-bezier(.22,1,.36,1) both}
.anim-in{animation:se-fade-in .5s ease both}
.page{animation:se-fade-in .45s ease both}
.anim-pop{animation:se-pop .45s cubic-bezier(.22,1,.36,1) both}
.anim-d1{animation-delay:.06s}
.anim-d2{animation-delay:.14s}
.anim-d3{animation-delay:.22s}
.anim-d4{animation-delay:.3s}
@media(prefers-reduced-motion:reduce){
  .anim-up,.anim-in,.anim-pop,.page{animation:none}
  .bar i{animation:none;transform:none}
}

/* Result reveal: stagger the hero pieces */
.result-live .result-grid{animation:se-fade-up .55s cubic-bezier(.22,1,.36,1) both;animation-delay:.05s}
.result-live .gradcam-panel{animation:se-fade-up .55s cubic-bezier(.22,1,.36,1) both;animation-delay:.12s}
.result-live .lowconf-note{animation:se-fade-in .5s ease both;animation-delay:.18s}

/* Disease bars grow smoothly */
@keyframes se-bar-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.bar i{transform-origin:left center;animation:se-bar-grow .8s cubic-bezier(.22,1,.36,1) both;animation-delay:.15s}

/* Hover lifts (cards, feature tiles, buttons) */
.card{transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease}
.feat-card,.platform .feat-card{transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease}
.feat-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px -22px rgba(0,0,0,.6);border-color:var(--border-2)}
.btn{transition:transform .14s ease, box-shadow .18s ease, background .18s ease, opacity .18s ease}
.btn:hover:not(:disabled){transform:translateY(-1px)}
.btn:active:not(:disabled){transform:translateY(0) scale(.985)}
.btn-primary:hover:not(:disabled){box-shadow:0 10px 26px -10px rgba(59,130,246,.7)}
.met{transition:transform .18s ease, border-color .18s ease}
.met:hover{transform:translateY(-2px);border-color:var(--border-2)}
.gc-class{transition:transform .14s ease, border-color .15s ease, background .15s ease}
.gc-class:hover:not(:disabled){transform:translateY(-1px)}
.lang-switch{transition:transform .14s ease, color .15s ease, border-color .15s ease, background .15s ease}
.lang-switch:hover{transform:translateY(-1px)}

/* Loading skeletons */
.skel{position:relative;overflow:hidden;background:var(--card-2);border-radius:8px}
.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);
  background:linear-gradient(90deg,transparent,rgba(148,163,184,.12),transparent);
  animation:se-shimmer 1.3s infinite}
.skel-row{height:46px;margin-bottom:8px;border-radius:10px}
.skel-line{height:12px;border-radius:6px;margin:7px 0}
.skel-wrap{padding:6px 0}

/* Toast notifications */
@keyframes se-toast-in{from{opacity:0;transform:translateX(24px) scale(.96)}to{opacity:1;transform:translateX(0) scale(1)}}
.toast-viewport{position:fixed;top:74px;right:18px;z-index:1000;display:flex;flex-direction:column;gap:10px;max-width:340px;pointer-events:none}
.toast{pointer-events:auto;display:flex;align-items:center;gap:10px;width:100%;text-align:left;
  padding:12px 14px;border-radius:12px;border:1px solid var(--border-2);background:var(--card);
  color:var(--fg);font-family:inherit;font-size:13.5px;font-weight:500;cursor:pointer;
  box-shadow:0 16px 40px -16px rgba(0,0,0,.6);animation:se-toast-in .32s cubic-bezier(.22,1,.36,1) both}
.toast-ic{display:flex;flex:0 0 auto;width:24px;height:24px;align-items:center;justify-content:center;border-radius:7px}
.toast-msg{line-height:1.35}
.toast-success{border-color:rgba(34,197,94,.4)}
.toast-success .toast-ic{background:rgba(34,197,94,.16);color:var(--success)}
.toast-error{border-color:rgba(239,68,68,.4)}
.toast-error .toast-ic{background:rgba(239,68,68,.16);color:var(--danger)}
.toast-info{border-color:rgba(59,130,246,.4)}
.toast-info .toast-ic{background:rgba(59,130,246,.16);color:var(--primary)}
@media(max-width:480px){.toast-viewport{top:auto;bottom:18px;left:14px;right:14px;max-width:none}}
@media(prefers-reduced-motion:reduce){.toast{animation:none}}

/* Session detail modal */
.sdm-overlay{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;
  padding:24px;background:rgba(2,6,23,.66);backdrop-filter:blur(4px);animation:se-fade-in .2s ease both}
.sdm{position:relative;width:100%;max-width:640px;max-height:88vh;overflow-y:auto;
  background:var(--card);border:1px solid var(--border-2);border-radius:18px;padding:26px 26px 30px;
  box-shadow:0 30px 80px -30px rgba(0,0,0,.7)}
.sdm-x{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:9px;border:1px solid var(--border-2);
  background:var(--card-2);color:var(--muted);cursor:pointer;font-size:15px;line-height:1;transition:.15s}
.sdm-x:hover{color:var(--fg);border-color:var(--primary)}
.sdm-h{margin:0 0 4px;font-size:21px}
.sdm-sub{margin:0 0 20px;color:var(--muted);font-size:13px}
.hist-row-click{cursor:pointer;transition:background .15s ease, border-color .15s ease}
.hist-row-click:hover{background:var(--card-2);border-color:var(--border-2)}
.hist-row-click:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}

/* History insights card */
.insights-card{background:linear-gradient(180deg,var(--card),var(--card-2))}
.insights-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
.insight-item{display:flex;align-items:flex-start;gap:11px;font-size:14px;line-height:1.45;color:var(--fg)}
.insight-dot{flex:0 0 auto;width:7px;height:7px;margin-top:7px;border-radius:50%;
  background:var(--primary);box-shadow:0 0 0 4px rgba(59,130,246,.14)}

/* History search & filter bar */
.hist-filters{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px}
.hist-search{position:relative;flex:1 1 240px;min-width:200px}
.hist-search input{width:100%;padding:9px 32px 9px 12px;border-radius:10px;border:1px solid var(--border-2);
  background:var(--card-2);color:var(--fg);font-family:inherit;font-size:13.5px}
.hist-search input:focus{outline:none;border-color:var(--primary)}
.hist-search-clear{position:absolute;top:50%;right:8px;transform:translateY(-50%);width:20px;height:20px;
  border:none;background:transparent;color:var(--muted);cursor:pointer;font-size:13px;line-height:1}
.hist-search-clear:hover{color:var(--fg)}
.hist-risk-select{padding:9px 12px;border-radius:10px;border:1px solid var(--border-2);
  background:var(--card-2);color:var(--fg);font-family:inherit;font-size:13.5px;cursor:pointer}
.hist-risk-select:focus{outline:none;border-color:var(--primary)}
.hist-count{margin-left:auto;white-space:nowrap}
@media(max-width:480px){.hist-count{margin-left:0;width:100%}}
@media(max-width:480px){.sdm{padding:22px 18px}.sdm-h{font-size:19px}}

/* ---- Mobile polish (augments existing breakpoints) ---- */
@media(max-width:560px){
  .se-wrap{padding:0 16px}
  .hero-btns{flex-direction:column;align-items:stretch}
  .hero-btns .btn{width:100%}
  .trust{gap:8px 14px}
  .result-actions{flex-direction:column;align-items:stretch}
  .result-actions .btn{width:100%}
  .batch-controls{flex-direction:column;align-items:stretch}
  .batch-controls .btn{width:100%}
}
@media(max-width:480px){
  .amodal{width:calc(100vw - 28px);padding:24px 18px}
  .amodal-h{font-size:21px}
  .page-h{font-size:21px}
  .gauge svg{width:148px;height:148px}
}

/* Print / export report */
@media print{
  @page{margin:14mm}
  .backdrop,.se-nav,.se-footer,.hero-btns,.result-actions,.disc-in,.cam-controls,
  .page-head,.batch-card,.gradcam-classes,.result-ghost{display:none!important}
  .screen-grid>.card:first-child{display:none!important}
  .screen-grid{display:block!important;gap:0!important}
  .se-app{background:#fff!important;color:#0F172A}
  .se-wrap.page{padding:0!important;max-width:100%!important;margin:0!important}
  .card{border:none!important;box-shadow:none!important;background:#fff!important;padding:0!important}
  .result-live .eyebrow{display:none!important}
  .result-live .card-head .mono{display:none!important}
  .result-live::before{content:"Smart Eye — Ocular Health Report";display:block;font-size:20px;font-weight:600;letter-spacing:-.01em;color:#0F172A;padding-bottom:10px;margin-bottom:18px;border-bottom:2px solid #0F172A}
  .result-grid{break-inside:avoid}
  .gradcam-panel{break-inside:avoid;margin-top:18px}
  .gradcam-img{max-width:240px}
  .mock-strip,.err-strip{border:1px solid #c00;color:#c00;background:#fff}
}

/* =====================================================================
   Auth, nav controls, boot loader
   ===================================================================== */
.boot{position:relative;z-index:1;min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--muted);font-size:14px}
.boot-spin{width:34px;height:34px;border-radius:50%;border:3px solid var(--border-2);border-top-color:var(--accent);animation:se-spin .8s linear infinite}

.pill-sm{padding:5px 10px;font-size:11px}
.nav-status{gap:8px}
.icon-btn{width:36px;height:36px;border-radius:9px;border:1px solid var(--border-2);background:rgba(255,255,255,.03);color:var(--muted);display:grid;place-items:center;cursor:pointer;transition:.15s;padding:0}
.icon-btn:hover{color:var(--fg);background:rgba(255,255,255,.07)}
.icon-btn svg{width:18px;height:18px}
.nav-pop{position:relative}
.badge{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:grid;place-items:center;font-family:var(--mono)}
.pop-panel{position:absolute;top:46px;right:0;width:300px;background:var(--card);border:1px solid var(--border-2);border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.45);overflow:hidden;z-index:60}
.pop-head{padding:13px 16px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);border-bottom:1px solid var(--border)}
.pop-empty{padding:22px 16px;color:var(--muted-2);font-size:13px;text-align:center}
.pop-item{display:flex;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);align-items:flex-start}
.pop-item:last-child{border-bottom:none}
.pop-dot{width:7px;height:7px;border-radius:50%;margin-top:5px;flex-shrink:0;background:var(--accent)}
.pop-item.warn .pop-dot{background:var(--warning)}
.pop-item.alert .pop-dot{background:var(--danger)}
.pop-item b{display:block;font-size:13px;font-weight:600;margin-bottom:2px}
.pop-item span{font-size:11.5px;color:var(--muted);line-height:1.45}
.user-btn{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.03);border:1px solid var(--border-2);border-radius:999px;padding:4px 12px 4px 4px;cursor:pointer;color:var(--fg);transition:.15s}
.user-btn:hover{background:rgba(255,255,255,.07)}
.avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-weight:600;font-size:12px;color:#fff;background:linear-gradient(135deg,#3B82F6,#06B6D4)}
.avatar.lg{width:38px;height:38px;font-size:15px}
.user-name{font-size:13px;font-weight:500;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pop-user{display:flex;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border)}
.pop-user b{display:block;font-size:13.5px}
.pop-user span{font-size:11.5px;color:var(--muted)}
.pop-action{width:100%;text-align:left;padding:12px 16px;background:none;border:none;color:var(--fg);font-size:13px;font-family:inherit;cursor:pointer}
.pop-action:hover{background:rgba(255,255,255,.05);color:#fca5a5}
@media(max-width:760px){.user-name{display:none}}

/* Login / register page */
.auth-wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:18px}
.auth-card{width:100%;max-width:420px;background:linear-gradient(180deg,rgba(17,24,39,.85),rgba(14,22,38,.8));border:1px solid var(--border);border-radius:20px;padding:30px;box-shadow:0 30px 70px rgba(0,0,0,.4)}
.auth-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.auth-brand .logo{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:linear-gradient(135deg,#3B82F6,#06B6D4);box-shadow:0 6px 18px rgba(59,130,246,.4)}
.auth-brand .logo svg{width:21px;height:21px}
.auth-brand b{font-size:17px;display:block;letter-spacing:-.02em}
.auth-brand .tag{font-size:9.5px;letter-spacing:.22em;color:var(--muted);text-transform:uppercase;display:block;margin-top:1px}
.auth-h{font-size:24px;font-weight:600;letter-spacing:-.02em}
.auth-sub{font-size:13.5px;color:var(--muted);margin-top:6px;line-height:1.5}
.auth-form{display:flex;flex-direction:column;gap:13px;margin-top:4px}
.field{display:flex;flex-direction:column;gap:6px}
.field span{font-size:12px;color:var(--muted-2);font-weight:500}
.field input{font-family:inherit;font-size:14px;color:var(--fg);background:var(--card-2);border:1px solid var(--border-2);border-radius:10px;padding:11px 13px;transition:.15s;width:100%}
.field input:focus{outline:none;border-color:var(--primary);background:rgba(59,130,246,.05)}
.field input::placeholder{color:var(--muted-2)}
.btn-block{width:100%}
.btn-google{width:100%;background:#fff;color:#1f2937;border:1px solid #e5e7eb;margin-top:18px;gap:10px;font-weight:500}
.btn-google:hover:not(:disabled){background:#f3f4f6}
.btn-google:disabled{opacity:.5;cursor:not-allowed}
.auth-or{display:flex;align-items:center;gap:12px;margin:18px 0 16px;color:var(--muted-2);font-size:12px}
.auth-or::before,.auth-or::after{content:'';flex:1;height:1px;background:var(--border)}
.auth-switch{font-size:13px;color:var(--muted);margin-top:16px;text-align:center}
.link-btn{background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;font-family:inherit;padding:0;text-decoration:underline;text-underline-offset:2px}
.auth-guest{margin-top:18px;padding-top:18px;border-top:1px solid var(--border)}
.auth-note{margin-top:9px;text-align:center;line-height:1.5}
.auth-disc{font-size:11.5px;color:var(--muted-2);max-width:420px;text-align:center;line-height:1.5}

/* =====================================================================
   Light theme
   ===================================================================== */
.se-app.theme-light{
  --bg:#F1F5F9; --bg-2:#E2E8F0; --card:#FFFFFF; --card-2:#F8FAFC;
  --fg:#0F172A; --muted:#475569; --muted-2:#94A3B8; --border:#E2E8F0; --border-2:#CBD5E1;
}
.theme-light .orb.a{opacity:.16}
.theme-light .orb.b{opacity:.1}
.theme-light .orb.c{opacity:.07}
.theme-light .grid-lines{opacity:.5;background-image:linear-gradient(#cbd5e1 1px,transparent 1px),linear-gradient(90deg,#cbd5e1 1px,transparent 1px)}
.theme-light .vignette{background:radial-gradient(ellipse 90% 80% at 50% -10%,rgba(59,130,246,.08),transparent 60%)}
.theme-light .se-nav{background:rgba(255,255,255,.82);border-bottom-color:var(--border)}
.theme-light .card,.theme-light .fcard{background:#fff;border-color:var(--border);box-shadow:0 1px 3px rgba(15,23,42,.06)}
.theme-light .auth-card{background:#fff}
.theme-light .pill,.theme-light .icon-btn,.theme-light .user-btn{background:#fff}
.theme-light .icon-btn:hover,.theme-light .user-btn:hover{background:#f1f5f9}
.theme-light .met,.theme-light .pred,.theme-light .dropzone,.theme-light .likert-btn,.theme-light .field input{background:#F8FAFC}
.theme-light .bar{background:#E2E8F0}
.theme-light .cam{background:radial-gradient(ellipse at 50% 40%,#e2e8f0,#cbd5e1)}
.theme-light .hero-h{color:#0F172A}
.theme-light .hero-sub,.theme-light .actions,.theme-light .disc-in p{color:var(--muted)}
.theme-light .pop-panel{background:#fff;box-shadow:0 20px 50px rgba(15,23,42,.18)}
.theme-light .hist-row:hover,.theme-light .nav-links a:hover{background:rgba(15,23,42,.04)}
.gradcam-panel{margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
.gradcam-img{display:block;width:100%;max-width:300px;border-radius:12px;margin:8px 0;border:1px solid var(--border)}
.theme-light .nav-links a.active{background:rgba(59,130,246,.12);color:var(--primary)}
.theme-light .btn-ghost{background:#fff}
.theme-light .btn-ghost:hover{background:#f1f5f9}
`;
