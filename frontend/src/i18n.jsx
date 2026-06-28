// Lightweight i18n for Smart Eye — no external library.
//
// A single dictionary of key -> { en, bn } strings, a React context that holds
// the active language (persisted to localStorage), and a `useT()` hook returning
// a `t(key)` lookup plus the current language and a setter. Adding another
// language is just another field on each entry.
import React, { createContext, useContext, useState, useCallback } from "react";

export const LANGS = [
  { code: "en", label: "EN", name: "English" },
  { code: "bn", label: "বাংলা", name: "Bangla" },
];

// All translatable strings. `bn` = Bengali. Keep keys stable; UI references these.
const DICT = {
  // ---- nav ----
  "nav.brandSub":       { en: "Clinical Intelligence", bn: "ক্লিনিক্যাল ইন্টেলিজেন্স" },
  "nav.home":           { en: "Home", bn: "হোম" },
  "nav.screening":      { en: "Screening", bn: "স্ক্রিনিং" },
  "nav.fatigue":        { en: "Fatigue", bn: "ক্লান্তি" },
  "nav.history":        { en: "History", bn: "ইতিহাস" },
  "nav.analytics":      { en: "Analytics", bn: "বিশ্লেষণ" },
  "nav.help":           { en: "Help", bn: "সাহায্য" },
  "a11y.toggle":        { en: "Accessibility mode (larger text & higher contrast)", bn: "অ্যাক্সেসিবিলিটি মোড (বড় টেক্সট ও উচ্চ কনট্রাস্ট)" },
  "nav.signIn":         { en: "Sign in", bn: "সাইন ইন" },
  "nav.signOut":        { en: "Sign out", bn: "সাইন আউট" },

  // ---- home ----
  "home.badge":         { en: "Preliminary screening workflow", bn: "প্রাথমিক স্ক্রিনিং ওয়ার্কফ্লো" },
  "home.title2":        { en: "EYE", bn: "আই" },
  "home.tagline":       { en: "AI-Powered Preliminary Vision Screening Platform", bn: "এআই-চালিত প্রাথমিক দৃষ্টি স্ক্রিনিং প্ল্যাটফর্ম" },
  "home.intro":         { en: "Screen fundus conditions, monitor visual fatigue in real time, and generate explainable ocular health assessments using computer vision, fuzzy intelligence, and privacy-first on-device processing.", bn: "ফান্ডাস অবস্থা স্ক্রিন করুন, রিয়েল টাইমে দৃষ্টিজনিত ক্লান্তি পর্যবেক্ষণ করুন এবং কম্পিউটার ভিশন, ফাজি ইন্টেলিজেন্স ও গোপনীয়তা-প্রথম অন-ডিভাইস প্রসেসিং ব্যবহার করে ব্যাখ্যাযোগ্য চক্ষু স্বাস্থ্য মূল্যায়ন তৈরি করুন।" },
  "home.startBtn":      { en: "Start Screening", bn: "স্ক্রিনিং শুরু করুন" },
  "home.fatigueBtn":    { en: "Live Fatigue Monitor", bn: "লাইভ ক্লান্তি মনিটর" },
  "home.feat1":         { en: "AI-Assisted Screening", bn: "এআই-সহায়ক স্ক্রিনিং" },
  "home.feat2":         { en: "Real-Time Fatigue Monitoring", bn: "রিয়েল-টাইম ক্লান্তি পর্যবেক্ষণ" },
  "home.feat3":         { en: "Explainable Results", bn: "ব্যাখ্যাযোগ্য ফলাফল" },
  "home.feat4":         { en: "GDPR-Compliant Local Processing", bn: "জিডিপিআর-সম্মত স্থানীয় প্রসেসিং" },

  // ---- home v2: hero heading (gradient accent) + stat band labels ----
  "home.heroPre":       { en: "Intelligent eye ", bn: "সবার জন্য বুদ্ধিমান চোখ " },
  "home.heroAccent":    { en: "screening", bn: "স্ক্রিনিং" },
  "home.heroPost":      { en: " for everyone", bn: "" },
  "home.stat1":         { en: "Fundus model accuracy", bn: "ফান্ডাস মডেল নির্ভুলতা" },
  "home.stat2":         { en: "Disease classes detected", bn: "শনাক্তকৃত রোগ শ্রেণি" },
  "home.stat3":         { en: "Real-time landmark rate", bn: "রিয়েল-টাইম ল্যান্ডমার্ক রেট" },
  "home.stat4":         { en: "Inference time", bn: "ইনফারেন্স সময়" },

  // ---- home: platform section + feature cards ----
  "home.plat.eyebrow":  { en: "The Platform", bn: "প্ল্যাটফর্ম" },
  "home.plat.title":    { en: "A complete preliminary screening pipeline", bn: "একটি সম্পূর্ণ প্রাথমিক স্ক্রিনিং পাইপলাইন" },
  "home.plat.lead":     { en: "From fundus classification to fuzzy-logic risk synthesis — every stage is transparent, reproducible, and runs locally on-device.", bn: "ফান্ডাস শ্রেণীবিভাগ থেকে ফাজি-লজিক ঝুঁকি সংশ্লেষণ পর্যন্ত — প্রতিটি ধাপ স্বচ্ছ, পুনরুৎপাদনযোগ্য এবং ডিভাইসে স্থানীয়ভাবে চলে।" },
  "home.c1.t":          { en: "Fundus disease screening", bn: "ফান্ডাস রোগ স্ক্রিনিং" },
  "home.c1.d":          { en: "CNN classification across four fundus classes (Normal, Cataract, Glaucoma, Diabetic Retinopathy) with calibrated confidence.", bn: "ক্যালিব্রেটেড আত্মবিশ্বাস সহ চারটি ফান্ডাস শ্রেণীতে (নরমাল, ছানি, গ্লুকোমা, ডায়াবেটিক রেটিনোপ্যাথি) সিএনএন শ্রেণীবিভাগ।" },
  "home.c2.t":          { en: "Real-time fatigue monitoring", bn: "রিয়েল-টাইম ক্লান্তি পর্যবেক্ষণ" },
  "home.c2.d":          { en: "In-browser webcam EAR tracking, blink-rate analysis and drowsiness detection with a live landmark overlay.", bn: "ব্রাউজারে ওয়েবক্যাম EAR ট্র্যাকিং, পলক-হার বিশ্লেষণ এবং লাইভ ল্যান্ডমার্ক ওভারলে সহ তন্দ্রা সনাক্তকরণ।" },
  "home.c3.t":          { en: "Ocular Health Index", bn: "চক্ষু স্বাস্থ্য সূচক" },
  "home.c3.d":          { en: "A single 0–100 score fusing CNN confidence, fatigue and symptom burden through a transparent fuzzy engine.", bn: "একটি স্বচ্ছ ফাজি ইঞ্জিনের মাধ্যমে সিএনএন আত্মবিশ্বাস, ক্লান্তি ও উপসর্গের ভার মিশিয়ে একটি একক ০–১০০ স্কোর।" },
  "home.c4.t":          { en: "Transparent fuzzy logic", bn: "স্বচ্ছ ফাজি লজিক" },
  "home.c4.d":          { en: "A Mamdani inference system maps the three inputs to risk — every rule activation is inspectable, not a black box.", bn: "একটি মামদানি ইনফারেন্স সিস্টেম তিনটি ইনপুটকে ঝুঁকিতে রূপান্তর করে — প্রতিটি নিয়ম সক্রিয়করণ পরিদর্শনযোগ্য, কোনো ব্ল্যাক বক্স নয়।" },
  "home.c5.t":          { en: "Session history & audit", bn: "সেশন ইতিহাস ও নিরীক্ষা" },
  "home.c5.d":          { en: "Every screening is persisted locally with its scores and timestamp, so results are reviewable and reproducible.", bn: "প্রতিটি স্ক্রিনিং তার স্কোর ও টাইমস্ট্যাম্প সহ স্থানীয়ভাবে সংরক্ষিত হয়, তাই ফলাফল পর্যালোচনাযোগ্য ও পুনরুৎপাদনযোগ্য।" },
  "home.c6.t":          { en: "Privacy-first by design", bn: "নকশায় গোপনীয়তা-প্রথম" },
  "home.c6.d":          { en: "Face detection runs on-device; only landmark coordinates leave the browser. No cloud image storage.", bn: "ফেস সনাক্তকরণ ডিভাইসে চলে; শুধু ল্যান্ডমার্ক স্থানাঙ্ক ব্রাউজার ছাড়ে। কোনো ক্লাউড ইমেজ সংরক্ষণ নেই।" },

  // ---- screening ----
  "screen.eyebrow":     { en: "Screening", bn: "স্ক্রিনিং" },
  "screen.title":       { en: "Disease screening & Ocular Health Index", bn: "রোগ স্ক্রিনিং ও চক্ষু স্বাস্থ্য সূচক" },
  "screen.run":         { en: "Run screening", bn: "স্ক্রিনিং চালান" },
  "screen.export":      { en: "Export / print report", bn: "রিপোর্ট এক্সপোর্ট / প্রিন্ট" },
  "screen.explain":     { en: "Explain prediction", bn: "পূর্বাভাস ব্যাখ্যা করুন" },
  "screen.resultTitle": { en: "Ocular Health Index", bn: "চক্ষু স্বাস্থ্য সূচক" },

  // ---- history ----
  "hist.eyebrow":       { en: "History", bn: "ইতিহাস" },
  "hist.title":         { en: "Session history", bn: "সেশন ইতিহাস" },
  "hist.signInTitle":   { en: "Sign in to save your history", bn: "আপনার ইতিহাস সংরক্ষণ করতে সাইন ইন করুন" },
  "hist.signInBody":    { en: "Your screenings are saved privately to your account. Sign in to keep a history you can revisit and export.", bn: "আপনার স্ক্রিনিংগুলি আপনার অ্যাকাউন্টে ব্যক্তিগতভাবে সংরক্ষিত হয়। পুনরায় দেখা ও এক্সপোর্ট করার মতো একটি ইতিহাস রাখতে সাইন ইন করুন।" },

  // ---- home: platform section ----
  "home.plat.eyebrow":  { en: "The Platform", bn: "প্ল্যাটফর্ম" },
  "home.plat.title":    { en: "A complete preliminary screening pipeline", bn: "একটি সম্পূর্ণ প্রাথমিক স্ক্রিনিং পাইপলাইন" },
  "home.plat.lead":     { en: "From fundus classification to fuzzy-logic risk synthesis — every stage is transparent, reproducible, and runs locally on-device.", bn: "ফান্ডাস শ্রেণিবিন্যাস থেকে ফাজি-লজিক ঝুঁকি সংশ্লেষণ পর্যন্ত — প্রতিটি ধাপ স্বচ্ছ, পুনরুৎপাদনযোগ্য এবং স্থানীয়ভাবে ডিভাইসে চলে।" },

  // ---- home: feature cards ----
  "home.c1.t": { en: "Fundus disease screening", bn: "ফান্ডাস রোগ স্ক্রিনিং" },
  "home.c1.d": { en: "CNN classification across four fundus classes (Normal, Cataract, Glaucoma, Diabetic Retinopathy) with calibrated confidence.", bn: "ক্যালিব্রেটেড আত্মবিশ্বাস সহ চারটি ফান্ডাস শ্রেণিতে (নরমাল, ছানি, গ্লুকোমা, ডায়াবেটিক রেটিনোপ্যাথি) সিএনএন শ্রেণিবিন্যাস।" },
  "home.c2.t": { en: "Real-time fatigue monitoring", bn: "রিয়েল-টাইম ক্লান্তি পর্যবেক্ষণ" },
  "home.c2.d": { en: "In-browser webcam EAR tracking, blink-rate analysis and drowsiness detection with a live landmark overlay.", bn: "লাইভ ল্যান্ডমার্ক ওভারলে সহ ইন-ব্রাউজার ওয়েবক্যাম EAR ট্র্যাকিং, ব্লিঙ্ক-রেট বিশ্লেষণ ও তন্দ্রা সনাক্তকরণ।" },
  "home.c3.t": { en: "Ocular Health Index", bn: "চক্ষু স্বাস্থ্য সূচক" },
  "home.c3.d": { en: "A single 0–100 score fusing CNN confidence, fatigue and symptom burden through a transparent fuzzy engine.", bn: "একটি স্বচ্ছ ফাজি ইঞ্জিনের মাধ্যমে সিএনএন আত্মবিশ্বাস, ক্লান্তি ও উপসর্গের ভার একত্রিত করে একটি একক ০–১০০ স্কোর।" },
  "home.c4.t": { en: "Transparent fuzzy logic", bn: "স্বচ্ছ ফাজি লজিক" },
  "home.c4.d": { en: "A Mamdani inference system maps the three inputs to risk — every rule activation is inspectable, not a black box.", bn: "একটি মামদানি ইনফারেন্স সিস্টেম তিনটি ইনপুটকে ঝুঁকিতে ম্যাপ করে — প্রতিটি নিয়ম সক্রিয়করণ পরিদর্শনযোগ্য, ব্ল্যাক বক্স নয়।" },
  "home.c5.t": { en: "Session history & audit", bn: "সেশন ইতিহাস ও অডিট" },
  "home.c5.d": { en: "Every screening is persisted locally with its scores and timestamp, so results are reviewable and reproducible.", bn: "প্রতিটি স্ক্রিনিং তার স্কোর ও টাইমস্ট্যাম্প সহ স্থানীয়ভাবে সংরক্ষিত হয়, তাই ফলাফল পর্যালোচনাযোগ্য ও পুনরুৎপাদনযোগ্য।" },
  "home.c6.t": { en: "Privacy-first by design", bn: "গোপনীয়তা-প্রথম নকশা" },
  "home.c6.d": { en: "Face detection runs on-device; only landmark coordinates leave the browser. No cloud image storage.", bn: "ফেস সনাক্তকরণ ডিভাইসেই চলে; শুধু ল্যান্ডমার্ক স্থানাঙ্ক ব্রাউজার ছাড়ে। কোনো ক্লাউড ইমেজ স্টোরেজ নেই।" },

  // ---- screening page ----
  "screen.lead":        { en: "Upload a fundus image and rate your symptoms. The server fuses both into a fuzzy-logic risk score.", bn: "একটি ফান্ডাস ছবি আপলোড করুন ও আপনার উপসর্গ মূল্যায়ন করুন। সার্ভার উভয়কে একটি ফাজি-লজিক ঝুঁকি স্কোরে একত্রিত করে।" },
  "screen.step1":       { en: "Step 1", bn: "ধাপ ১" },
  "screen.inputs":      { en: "Screening inputs", bn: "স্ক্রিনিং ইনপুট" },
  "screen.symptomSurvey": { en: "Symptom survey · 1 (none) – 5 (severe)", bn: "উপসর্গ জরিপ · ১ (নেই) – ৫ (তীব্র)" },
  "screen.scoring":     { en: "Scoring…", bn: "স্কোরিং…" },
  "screen.runArrow":    { en: "Run screening →", bn: "স্ক্রিনিং চালান →" },
  "screen.noImageHint": { en: "No image? You'll still get an OHI from symptoms alone — disease screening is simply skipped.", bn: "ছবি নেই? আপনি কেবল উপসর্গ থেকেও একটি OHI পাবেন — রোগ স্ক্রিনিং কেবল বাদ দেওয়া হয়।" },
  "screen.ghostText":   { en: "Run a screening to generate your Ocular Health Index, class probabilities, and triage recommendation.", bn: "আপনার চক্ষু স্বাস্থ্য সূচক, শ্রেণি সম্ভাবনা ও ট্রায়াজ সুপারিশ তৈরি করতে একটি স্ক্রিনিং চালান।" },
  "screen.fundusAck":   { en: "I understand. Screen this image anyway.", bn: "আমি বুঝেছি। তবুও এই ছবিটি স্ক্রিন করুন।" },
  "screen.resultEyebrow": { en: "Result", bn: "ফলাফল" },
  "screen.mockStrip":   { en: "Mock model — placeholder probabilities, not a screening result.", bn: "মক মডেল — স্থানধারক সম্ভাবনা, কোনো স্ক্রিনিং ফলাফল নয়।" },
  "screen.diseaseProbs": { en: "Disease probabilities", bn: "রোগের সম্ভাবনা" },
  "screen.noFundusBars": { en: "No fundus image submitted — disease screening skipped.", bn: "কোনো ফান্ডাস ছবি জমা দেওয়া হয়নি — রোগ স্ক্রিনিং বাদ দেওয়া হয়েছে।" },
  "screen.recSteps":    { en: "Recommended next steps", bn: "প্রস্তাবিত পরবর্তী পদক্ষেপ" },
  "screen.lowConf":     { en: "Low model confidence", bn: "মডেলের আত্মবিশ্বাস কম" },
  "screen.lowConfTail": { en: "This result is uncertain — treat it with extra caution and prioritise professional review.", bn: "এই ফলাফলটি অনিশ্চিত — অতিরিক্ত সতর্কতার সাথে নিন এবং পেশাদার পর্যালোচনাকে অগ্রাধিকার দিন।" },
  "screen.generating":  { en: "Generating…", bn: "তৈরি হচ্ছে…" },
  "screen.savedHist":   { en: "Saved to history", bn: "ইতিহাসে সংরক্ষিত" },
  "screen.signInSave":  { en: "Sign in to save this result to your history.", bn: "এই ফলাফলটি আপনার ইতিহাসে সংরক্ষণ করতে সাইন ইন করুন।" },
  "screen.gradcamTitle": { en: "Grad-CAM — where the model looked", bn: "Grad-CAM — মডেল যেখানে দেখেছে" },
  "screen.showing":     { en: "Showing", bn: "দেখানো হচ্ছে" },
  "screen.gradcamCaption": { en: "Warm regions show the areas of the fundus that most influenced the prediction (ResNet branch). This is an explainability aid, not a diagnostic marker.", bn: "উষ্ণ অঞ্চলগুলি ফান্ডাসের সেই এলাকাগুলি দেখায় যা পূর্বাভাসকে সবচেয়ে বেশি প্রভাবিত করেছে (ResNet শাখা)। এটি একটি ব্যাখ্যামূলক সহায়ক, রোগনির্ণয়ের চিহ্ন নয়।" },

  // ---- batch screening ----
  "batch.eyebrow":      { en: "Batch", bn: "ব্যাচ" },
  "batch.title":        { en: "Batch screening", bn: "ব্যাচ স্ক্রিনিং" },
  "batch.intro":        { en: "Screen several fundus images at once. Each is scored on the image alone (symptoms neutral) and saved to history.", bn: "একসাথে একাধিক ফান্ডাস ছবি স্ক্রিন করুন। প্রতিটি কেবল ছবির ভিত্তিতে স্কোর করা হয় (উপসর্গ নিরপেক্ষ) এবং ইতিহাসে সংরক্ষিত হয়।" },
  "batch.select":       { en: "Select fundus images", bn: "ফান্ডাস ছবি নির্বাচন করুন" },
  "batch.screenAll":    { en: "Screen all", bn: "সব স্ক্রিন করুন" },
  "batch.colFile":      { en: "File", bn: "ফাইল" },
  "batch.colOhi":       { en: "OHI", bn: "OHI" },
  "batch.colRisk":      { en: "Risk", bn: "ঝুঁকি" },
  "batch.colTop":       { en: "Top finding", bn: "শীর্ষ ফলাফল" },
  "batch.colConf":      { en: "Conf.", bn: "আত্মবিশ্বাস" },
  "batch.imagesSelected": { en: "image(s) selected", bn: "ছবি নির্বাচিত" },
  "batch.failed":       { en: "Failed", bn: "ব্যর্থ" },

  // ---- dropzone / camera ----
  "drop.main":          { en: "Drop a fundus image, or click to browse", bn: "একটি ফান্ডাস ছবি ফেলুন, বা ব্রাউজ করতে ক্লিক করুন" },
  "drop.sub":           { en: "JPEG / PNG · 4-class screening", bn: "JPEG / PNG · ৪-শ্রেণি স্ক্রিনিং" },
  "drop.camera":        { en: "Take a photo with camera", bn: "ক্যামেরা দিয়ে ছবি তুলুন" },

  // ---- symptom labels ----
  "symptom.pain":           { en: "Eye pain", bn: "চোখে ব্যথা" },
  "symptom.redness":        { en: "Redness", bn: "লালভাব" },
  "symptom.photophobia":    { en: "Light sensitivity", bn: "আলোক সংবেদনশীলতা" },
  "symptom.blurred_vision": { en: "Blurred vision", bn: "ঝাপসা দৃষ্টি" },

  // ---- disease class names ----
  "class.Normal":               { en: "Normal", bn: "নরমাল" },
  "class.Cataract":             { en: "Cataract", bn: "ছানি" },
  "class.Glaucoma":             { en: "Glaucoma", bn: "গ্লুকোমা" },
  "class.Diabetic_Retinopathy": { en: "Diabetic Retinopathy", bn: "ডায়াবেটিক রেটিনোপ্যাথি" },

  // ---- fatigue page ----
  "fat.eyebrow":        { en: "Fatigue", bn: "ক্লান্তি" },
  "fat.title":          { en: "Real-time fatigue & drowsiness monitor", bn: "রিয়েল-টাইম ক্লান্তি ও তন্দ্রা মনিটর" },
  "fat.lead":           { en: "Webcam eye-aspect-ratio tracking with blink-rate analysis. Processing is on-device; only coordinates are sent to score EAR.", bn: "ব্লিঙ্ক-রেট বিশ্লেষণ সহ ওয়েবক্যাম আই-অ্যাসপেক্ট-রেশিও ট্র্যাকিং। প্রসেসিং ডিভাইসেই হয়; শুধু স্থানাঙ্ক EAR স্কোর করতে পাঠানো হয়।" },
  "fat.live":           { en: "Live", bn: "লাইভ" },
  "fat.monitor":        { en: "Fatigue monitor", bn: "ক্লান্তি মনিটর" },
  "fat.st.idle":        { en: "idle", bn: "নিষ্ক্রিয়" },
  "fat.st.loading":     { en: "loading models", bn: "মডেল লোড হচ্ছে" },
  "fat.st.noface":      { en: "no face", bn: "মুখ নেই" },
  "fat.st.liveLabel":   { en: "live", bn: "লাইভ" },
  "fat.noFaceBadge":    { en: "NO FACE", bn: "মুখ নেই" },
  "fat.tracking":       { en: "TRACKING", bn: "ট্র্যাকিং" },
  "fat.drowsyAlert":    { en: "DROWSINESS ALERT", bn: "তন্দ্রা সতর্কতা" },
  "fat.idleText":       { en: "press Start camera to begin tracking", bn: "ট্র্যাকিং শুরু করতে Start camera চাপুন" },
  "fat.loadingMesh":    { en: "loading face mesh…", bn: "ফেস মেশ লোড হচ্ছে…" },
  "fat.ear":            { en: "EAR", bn: "EAR" },
  "fat.blink":          { en: "Blink / min", bn: "ব্লিঙ্ক / মিনিট" },
  "fat.fatigue":        { en: "Fatigue", bn: "ক্লান্তি" },
  "fat.session":        { en: "Session", bn: "সেশন" },
  "fat.startCam":       { en: "Start camera", bn: "ক্যামেরা শুরু করুন" },
  "fat.loadingModels":  { en: "Loading models…", bn: "মডেল লোড হচ্ছে…" },
  "fat.stopCam":        { en: "Stop camera", bn: "ক্যামেরা বন্ধ করুন" },
  "fat.disc":           { en: "Face detection runs entirely in your browser (MediaPipe Face Mesh). Only landmark coordinates are sent to the server to compute EAR — your video never leaves this device.", bn: "ফেস সনাক্তকরণ সম্পূর্ণরূপে আপনার ব্রাউজারে চলে (MediaPipe Face Mesh)। শুধু ল্যান্ডমার্ক স্থানাঙ্ক EAR গণনা করতে সার্ভারে পাঠানো হয় — আপনার ভিডিও কখনো এই ডিভাইস ছাড়ে না।" },

  // ---- history page (signed-in view) ----
  "hist.lead":          { en: "Your screenings are saved privately to your account — only scores and timestamps, no images.", bn: "আপনার স্ক্রিনিংগুলি আপনার অ্যাকাউন্টে ব্যক্তিগতভাবে সংরক্ষিত হয় — শুধু স্কোর ও টাইমস্ট্যাম্প, কোনো ছবি নয়।" },
  "hist.loadError":     { en: "Could not load history", bn: "ইতিহাস লোড করা যায়নি" },
  "hist.trend":         { en: "Trend", bn: "প্রবণতা" },
  "hist.trendTitle":    { en: "Ocular Health Index over time", bn: "সময়ের সাথে চক্ষু স্বাস্থ্য সূচক" },
  "hist.trendCaption":  { en: "Oldest → newest. Dashed line marks OHI 67 (the Low/Moderate boundary). Higher is healthier.", bn: "পুরোনো → নতুন। ড্যাশড লাইন OHI ৬৭ চিহ্নিত করে (নিম্ন/মাঝারি সীমা)। বেশি হলে স্বাস্থ্যকর।" },
  "hist.trendEmpty":    { en: "Run at least two screenings to see your OHI trend.", bn: "আপনার OHI প্রবণতা দেখতে অন্তত দুটি স্ক্রিনিং চালান।" },
  "hist.statScreenings": { en: "Screenings", bn: "স্ক্রিনিং" },
  "hist.statAvg":       { en: "Average OHI", bn: "গড় OHI" },
  "hist.statLatest":    { en: "Latest OHI", bn: "সর্বশেষ OHI" },
  "hist.statHighRisk":  { en: "High-risk", bn: "উচ্চ-ঝুঁকি" },
  "hist.compare":       { en: "Compare", bn: "তুলনা" },
  "hist.compareTitle":  { en: "Compare two screenings", bn: "দুটি স্ক্রিনিং তুলনা করুন" },
  "hist.compareEmpty":  { en: "Run at least two screenings to compare them.", bn: "তুলনা করতে অন্তত দুটি স্ক্রিনিং চালান।" },
  "hist.cmpRisk":       { en: "Risk", bn: "ঝুঁকি" },
  "hist.cmpTop":        { en: "Top finding", bn: "শীর্ষ ফলাফল" },
  "hist.cmpConf":       { en: "Confidence", bn: "আত্মবিশ্বাস" },
  "hist.cmpFat":        { en: "Fatigue", bn: "ক্লান্তি" },
  "hist.records":       { en: "Records", bn: "রেকর্ড" },
  "hist.allSessions":   { en: "All sessions", bn: "সব সেশন" },
  "hist.downloadCsv":   { en: "Download CSV", bn: "CSV ডাউনলোড করুন" },
  "hist.loading":       { en: "Loading…", bn: "লোড হচ্ছে…" },
  "hist.empty":         { en: "No sessions yet — run a screening and it will appear here.", bn: "এখনো কোনো সেশন নেই — একটি স্ক্রিনিং চালান এবং এটি এখানে দেখা যাবে।" },
  "hist.colWhen":       { en: "When", bn: "কখন" },
  "hist.colRisk":       { en: "Risk", bn: "ঝুঁকি" },
  "hist.colTop":        { en: "Top finding", bn: "শীর্ষ ফলাফল" },
  "hist.colConf":       { en: "Conf.", bn: "আত্মবিশ্বাস" },
  "hist.colFat":        { en: "Fatigue", bn: "ক্লান্তি" },
  "hist.deleteTitle":   { en: "Delete session", bn: "সেশন মুছুন" },

  // ---- login / auth page ----
  "auth.brandSub":      { en: "Clinical Intelligence", bn: "ক্লিনিক্যাল ইন্টেলিজেন্স" },
  "auth.welcomeBack":   { en: "Welcome back", bn: "আবার স্বাগতম" },
  "auth.createAccount": { en: "Create your account", bn: "আপনার অ্যাকাউন্ট তৈরি করুন" },
  "auth.subLogin":      { en: "Sign in to access your screenings and history.", bn: "আপনার স্ক্রিনিং ও ইতিহাস অ্যাক্সেস করতে সাইন ইন করুন।" },
  "auth.subRegister":   { en: "Register to save your screenings to your own private history.", bn: "আপনার নিজস্ব ব্যক্তিগত ইতিহাসে স্ক্রিনিং সংরক্ষণ করতে নিবন্ধন করুন।" },
  "auth.signInFailed":  { en: "Sign-in failed. Please try again.", bn: "সাইন-ইন ব্যর্থ হয়েছে। আবার চেষ্টা করুন।" },
  "auth.googleErrNotConfigured": { en: "Google sign-in isn't configured on the server yet.", bn: "সার্ভারে Google সাইন-ইন এখনো কনফিগার করা হয়নি।" },
  "auth.googleErrFailed": { en: "Google sign-in didn't complete. Please try again.", bn: "Google সাইন-ইন সম্পূর্ণ হয়নি। আবার চেষ্টা করুন।" },
  "auth.googleContinue": { en: "Continue with Google", bn: "Google দিয়ে চালিয়ে যান" },
  "auth.googleNotConfigured": { en: "Google sign-in is not configured on the server", bn: "সার্ভারে Google সাইন-ইন কনফিগার করা নেই" },
  "auth.googleNote":    { en: "Google sign-in appears once the server has Google OAuth credentials configured.", bn: "সার্ভারে Google OAuth শংসাপত্র কনফিগার হলে Google সাইন-ইন দেখা যাবে।" },
  "auth.or":            { en: "or", bn: "অথবা" },
  "auth.name":          { en: "Name", bn: "নাম" },
  "auth.namePlaceholder": { en: "Your name", bn: "আপনার নাম" },
  "auth.email":         { en: "Email", bn: "ইমেল" },
  "auth.password":      { en: "Password", bn: "পাসওয়ার্ড" },
  "auth.passwordRegister": { en: "At least 6 characters", bn: "অন্তত ৬টি অক্ষর" },
  "auth.passwordLogin": { en: "Your password", bn: "আপনার পাসওয়ার্ড" },
  "auth.pleaseWait":    { en: "Please wait…", bn: "অনুগ্রহ করে অপেক্ষা করুন…" },
  "auth.signIn":        { en: "Sign in", bn: "সাইন ইন" },
  "auth.createAccountBtn": { en: "Create account", bn: "অ্যাকাউন্ট তৈরি করুন" },
  "auth.newHere":       { en: "New to Smart Eye?", bn: "Smart Eye-এ নতুন?" },
  "auth.haveAccount":   { en: "Already have an account?", bn: "ইতিমধ্যে একটি অ্যাকাউন্ট আছে?" },
  "auth.createLink":    { en: "Create an account", bn: "একটি অ্যাকাউন্ট তৈরি করুন" },
  "auth.continueGuest": { en: "Continue as guest", bn: "অতিথি হিসেবে চালিয়ে যান" },
  "auth.guestNote":     { en: "No account needed. Screenings are saved to a shared anonymous history on this server.", bn: "কোনো অ্যাকাউন্টের প্রয়োজন নেই। স্ক্রিনিংগুলি এই সার্ভারে একটি শেয়ার্ড বেনামী ইতিহাসে সংরক্ষিত হয়।" },

  // ---- auth modal (nav popup) ----
  "amodal.subRegister": { en: "Register to save your screenings to a private history.", bn: "একটি ব্যক্তিগত ইতিহাসে আপনার স্ক্রিনিং সংরক্ষণ করতে নিবন্ধন করুন।" },
  "amodal.subLogin":    { en: "Sign in to continue to Smart Eye.", bn: "Smart Eye-এ চালিয়ে যেতে সাইন ইন করুন।" },
  "amodal.fullName":    { en: "Full name", bn: "পুরো নাম" },
  "amodal.emailPlaceholder": { en: "Email address", bn: "ইমেল ঠিকানা" },
  "amodal.pwRegister":  { en: "Password (min 6 characters)", bn: "পাসওয়ার্ড (অন্তত ৬টি অক্ষর)" },
  "amodal.pwLogin":     { en: "Password", bn: "পাসওয়ার্ড" },
  "amodal.confirmPw":   { en: "Confirm password", bn: "পাসওয়ার্ড নিশ্চিত করুন" },
  "amodal.continue":    { en: "Continue", bn: "চালিয়ে যান" },
  "amodal.googleNote":  { en: "Continue with Google activates once the server has OAuth credentials set.", bn: "সার্ভারে OAuth শংসাপত্র সেট হলে Google দিয়ে চালিয়ে যান সক্রিয় হবে।" },
  "amodal.login":       { en: "Log in", bn: "লগ ইন" },
  "amodal.signUp":      { en: "Sign up", bn: "সাইন আপ" },
  "amodal.signUpPrompt": { en: "Don't have an account?", bn: "অ্যাকাউন্ট নেই?" },

  // ---- toast notifications ----
  "toast.saved":        { en: "Saved to your history", bn: "আপনার ইতিহাসে সংরক্ষিত" },
  "toast.scoreDone":    { en: "Screening complete", bn: "স্ক্রিনিং সম্পন্ন" },
  "toast.deleted":      { en: "Session deleted", bn: "সেশন মুছে ফেলা হয়েছে" },
  "toast.exported":     { en: "History exported as CSV", bn: "ইতিহাস CSV হিসেবে এক্সপোর্ট হয়েছে" },

  // ---- session detail modal ----
  "detail.title":       { en: "Screening detail", bn: "স্ক্রিনিং বিবরণ" },
  "detail.loading":     { en: "Loading session…", bn: "সেশন লোড হচ্ছে…" },
  "detail.loadError":   { en: "Could not load this session.", bn: "এই সেশনটি লোড করা যায়নি।" },
  "detail.recorded":    { en: "Recorded", bn: "রেকর্ড করা হয়েছে" },
  "detail.downloadPdf": { en: "Download full report (PDF)", bn: "সম্পূর্ণ রিপোর্ট ডাউনলোড করুন (PDF)" },
  "detail.share":       { en: "Share report", bn: "রিপোর্ট শেয়ার করুন" },
  "detail.sharing":     { en: "Sharing…", bn: "শেয়ার হচ্ছে…" },
  "detail.preparing":   { en: "Preparing…", bn: "প্রস্তুত হচ্ছে…" },
  "detail.pdfError":    { en: "Could not generate the PDF.", bn: "PDF তৈরি করা যায়নি।" },
  "detail.close":       { en: "Close", bn: "বন্ধ করুন" },
  "toast.pdfDownloaded": { en: "Report downloaded", bn: "রিপোর্ট ডাউনলোড হয়েছে" },
  "toast.shared":       { en: "Report shared", bn: "রিপোর্ট শেয়ার হয়েছে" },

  // ---- doctor visit reminder ----
  "remind.highTitle":   { en: "Consider booking an eye exam", bn: "একটি চোখ পরীক্ষার অ্যাপয়েন্টমেন্ট বিবেচনা করুন" },
  "remind.highBody":    { en: "Your most recent screening flagged a high-risk result. A professional eye examination is recommended — this tool is a preliminary screen, not a diagnosis.", bn: "আপনার সাম্প্রতিক স্ক্রিনিং একটি উচ্চ-ঝুঁকির ফলাফল চিহ্নিত করেছে। একটি পেশাদার চোখ পরীক্ষার সুপারিশ করা হয় — এই সরঞ্জামটি একটি প্রাথমিক স্ক্রিন, রোগনির্ণয় নয়।" },
  "remind.dueTitle":    { en: "Time for a follow-up screening", bn: "একটি ফলো-আপ স্ক্রিনিংয়ের সময়" },
  "remind.dueBody":     { en: "It's been a while since your last screening. Regular checks help catch changes early.", bn: "আপনার শেষ স্ক্রিনিংয়ের পর থেকে কিছু সময় হয়ে গেছে। নিয়মিত পরীক্ষা পরিবর্তনগুলি প্রাথমিকভাবে ধরতে সাহায্য করে।" },
  "remind.addCalendar": { en: "Add reminder to calendar", bn: "ক্যালেন্ডারে অনুস্মারক যোগ করুন" },
  "remind.dismiss":     { en: "Dismiss", bn: "বাতিল করুন" },
  "remind.eventTitle":  { en: "Smart Eye — eye screening follow-up", bn: "Smart Eye — চোখ স্ক্রিনিং ফলো-আপ" },
  "remind.eventDesc":   { en: "Follow-up reminder from your Smart Eye screening. Consider booking an appointment with an eye-care professional.", bn: "আপনার Smart Eye স্ক্রিনিং থেকে ফলো-আপ অনুস্মারক। একজন চক্ষু-বিশেষজ্ঞের সাথে অ্যাপয়েন্টমেন্ট বিবেচনা করুন।" },
  "toast.calendarAdded": { en: "Calendar reminder downloaded", bn: "ক্যালেন্ডার অনুস্মারক ডাউনলোড হয়েছে" },

  // ---- user profile ----
  "profile.menuLink":   { en: "Profile", bn: "প্রোফাইল" },
  "profile.eyebrow":    { en: "Profile", bn: "প্রোফাইল" },
  "profile.title":      { en: "Your profile", bn: "আপনার প্রোফাইল" },
  "profile.lead":       { en: "Manage your details and health context. This information is stored privately on this device.", bn: "আপনার বিবরণ ও স্বাস্থ্য প্রসঙ্গ পরিচালনা করুন। এই তথ্য এই ডিভাইসে ব্যক্তিগতভাবে সংরক্ষিত হয়।" },
  "profile.signInTitle": { en: "Sign in to manage your profile", bn: "আপনার প্রোফাইল পরিচালনা করতে সাইন ইন করুন" },
  "profile.signInBody": { en: "Your profile is tied to your account. Sign in to view and edit your details.", bn: "আপনার প্রোফাইল আপনার অ্যাকাউন্টের সাথে যুক্ত। আপনার বিবরণ দেখতে ও সম্পাদনা করতে সাইন ইন করুন।" },
  "profile.photo":      { en: "Profile photo", bn: "প্রোফাইল ছবি" },
  "profile.changePhoto": { en: "Change photo", bn: "ছবি পরিবর্তন করুন" },
  "profile.removePhoto": { en: "Remove", bn: "সরান" },
  "profile.secAccount": { en: "Account", bn: "অ্যাকাউন্ট" },
  "profile.secHealth":  { en: "Health context", bn: "স্বাস্থ্য প্রসঙ্গ" },
  "profile.secPrefs":   { en: "Preferences", bn: "পছন্দসমূহ" },
  "profile.name":       { en: "Full name", bn: "পুরো নাম" },
  "profile.email":      { en: "Email", bn: "ইমেল" },
  "profile.emailNote":  { en: "Your account email can't be changed here.", bn: "আপনার অ্যাকাউন্ট ইমেল এখানে পরিবর্তন করা যাবে না।" },
  "profile.age":        { en: "Age", bn: "বয়স" },
  "profile.gender":     { en: "Gender", bn: "লিঙ্গ" },
  "profile.gUnspecified": { en: "Prefer not to say", bn: "বলতে চাই না" },
  "profile.gMale":      { en: "Male", bn: "পুরুষ" },
  "profile.gFemale":    { en: "Female", bn: "মহিলা" },
  "profile.gOther":     { en: "Other", bn: "অন্যান্য" },
  "profile.diabetes":   { en: "Diabetes", bn: "ডায়াবেটিস" },
  "profile.hypertension": { en: "Hypertension (high blood pressure)", bn: "উচ্চ রক্তচাপ" },
  "profile.familyHistory": { en: "Family history of eye disease", bn: "চোখের রোগের পারিবারিক ইতিহাস" },
  "profile.vision":     { en: "Vision correction", bn: "দৃষ্টি সংশোধন" },
  "profile.vNone":      { en: "None", bn: "কোনোটিই নয়" },
  "profile.vGlasses":   { en: "Glasses", bn: "চশমা" },
  "profile.vContacts":  { en: "Contact lenses", bn: "কন্টাক্ট লেন্স" },
  "profile.optNo":      { en: "No", bn: "না" },
  "profile.optYes":     { en: "Yes", bn: "হ্যাঁ" },
  "profile.optPre":     { en: "Prediabetes", bn: "প্রিডায়াবেটিস" },
  "profile.language":   { en: "Language", bn: "ভাষা" },
  "profile.theme":      { en: "Theme", bn: "থিম" },
  "profile.themeDark":  { en: "Dark", bn: "গাঢ়" },
  "profile.themeLight": { en: "Light", bn: "হালকা" },
  "profile.save":       { en: "Save changes", bn: "পরিবর্তন সংরক্ষণ করুন" },
  "profile.saved":      { en: "Profile saved", bn: "প্রোফাইল সংরক্ষিত হয়েছে" },
  "profile.photoTooBig": { en: "Image is too large (max 2 MB).", bn: "ছবিটি খুব বড় (সর্বোচ্চ ২ MB)।" },

  // ---- history insights (placeholders {n} {c} {cls} filled at runtime) ----
  "ins.title":    { en: "Insights", bn: "অন্তর্দৃষ্টি" },
  "ins.single":   { en: "One screening recorded — run a few more to unlock trend insights.", bn: "একটি স্ক্রিনিং রেকর্ড হয়েছে — প্রবণতা অন্তর্দৃষ্টি আনলক করতে আরও কয়েকটি চালান।" },
  "ins.ohiUp":    { en: "Your OHI improved {n} points across your last {c} screenings.", bn: "আপনার শেষ {c}টি স্ক্রিনিংয়ে আপনার OHI {n} পয়েন্ট উন্নত হয়েছে।" },
  "ins.ohiDown":  { en: "Your OHI declined {n} points across your last {c} screenings.", bn: "আপনার শেষ {c}টি স্ক্রিনিংয়ে আপনার OHI {n} পয়েন্ট কমেছে।" },
  "ins.ohiFlat":  { en: "Your OHI held steady across your last {c} screenings.", bn: "আপনার শেষ {c}টি স্ক্রিনিংয়ে আপনার OHI স্থির ছিল।" },
  "ins.frequent": { en: "{cls} was your most frequent finding ({n} of {c} scans).", bn: "{cls} ছিল আপনার সবচেয়ে ঘন ঘন ফলাফল ({c}টির মধ্যে {n}টিতে)।" },
  "ins.best":     { en: "Your best score so far is {n}.", bn: "এখন পর্যন্ত আপনার সেরা স্কোর {n}।" },
  "ins.avgFatigue": { en: "Average fatigue across sessions: {n}/100.", bn: "সেশনগুলিতে গড় ক্লান্তি: {n}/100।" },

  // ---- history search & filter ----
  "filter.search":      { en: "Search by finding or date…", bn: "ফলাফল বা তারিখ দিয়ে খুঁজুন…" },
  "filter.allRisks":    { en: "All risk levels", bn: "সব ঝুঁকির স্তর" },
  "filter.riskLow":     { en: "Low risk", bn: "নিম্ন ঝুঁকি" },
  "filter.riskModerate": { en: "Moderate risk", bn: "মাঝারি ঝুঁকি" },
  "filter.riskHigh":    { en: "High risk", bn: "উচ্চ ঝুঁকি" },
  "filter.showing":     { en: "Showing {n} of {c}", bn: "{c}টির মধ্যে {n}টি দেখানো হচ্ছে" },
  "filter.noMatch":     { en: "No sessions match your search.", bn: "আপনার অনুসন্ধানের সাথে কোনো সেশন মেলে না।" },
  "filter.clear":       { en: "Clear", bn: "মুছুন" },

  // ---- analytics dashboard ----
  "an.eyebrow":         { en: "Analytics", bn: "বিশ্লেষণ" },
  "an.title":           { en: "Screening analytics", bn: "স্ক্রিনিং বিশ্লেষণ" },
  "an.lead":            { en: "An overview of all your screenings — totals, disease distribution, and how your Ocular Health Index has trended.", bn: "আপনার সমস্ত স্ক্রিনিংয়ের একটি সংক্ষিপ্ত বিবরণ — মোট সংখ্যা, রোগ বণ্টন এবং আপনার চক্ষু স্বাস্থ্য সূচকের প্রবণতা।" },
  "an.signInTitle":     { en: "Sign in to see your analytics", bn: "আপনার বিশ্লেষণ দেখতে সাইন ইন করুন" },
  "an.signInBody":      { en: "Analytics are built from your saved screenings. Sign in to track totals and trends over time.", bn: "বিশ্লেষণ আপনার সংরক্ষিত স্ক্রিনিং থেকে তৈরি হয়। সময়ের সাথে মোট ও প্রবণতা ট্র্যাক করতে সাইন ইন করুন।" },
  "an.empty":           { en: "No screenings yet — run a screening and your analytics will appear here.", bn: "এখনো কোনো স্ক্রিনিং নেই — একটি স্ক্রিনিং চালান এবং আপনার বিশ্লেষণ এখানে দেখা যাবে।" },
  "an.statTotal":       { en: "Total screenings", bn: "মোট স্ক্রিনিং" },
  "an.statAvg":         { en: "Average OHI", bn: "গড় OHI" },
  "an.statHigh":        { en: "High-risk results", bn: "উচ্চ-ঝুঁকির ফলাফল" },
  "an.statFatigue":     { en: "Average fatigue", bn: "গড় ক্লান্তি" },
  "an.diseaseTitle":    { en: "Disease distribution", bn: "রোগ বণ্টন" },
  "an.diseaseSub":      { en: "How often each class was the top finding", bn: "প্রতিটি শ্রেণি কতবার শীর্ষ ফলাফল ছিল" },
  "an.riskTitle":       { en: "Risk breakdown", bn: "ঝুঁকি বিভাজন" },
  "an.trendTitle":      { en: "OHI over time", bn: "সময়ের সাথে OHI" },
  "an.trendSub":        { en: "Oldest to newest — higher is healthier", bn: "পুরোনো থেকে নতুন — বেশি হলে স্বাস্থ্যকর" },
  "an.noFinding":       { en: "No findings recorded yet.", bn: "এখনো কোনো ফলাফল রেকর্ড করা হয়নি।" },
  "an.scans":           { en: "scans", bn: "স্ক্যান" },

  // ---- help & education page ----
  "help.eyebrow":       { en: "Help & Education", bn: "সাহায্য ও শিক্ষা" },
  "help.title":         { en: "Understanding eye health", bn: "চোখের স্বাস্থ্য বোঝা" },
  "help.lead":          { en: "Learn about the conditions Smart Eye screens for, how to protect your vision, and how the screening works. This is educational information, not a medical diagnosis.", bn: "Smart Eye যে অবস্থাগুলি স্ক্রিন করে সেগুলি সম্পর্কে জানুন, কীভাবে আপনার দৃষ্টি রক্ষা করবেন এবং স্ক্রিনিং কীভাবে কাজ করে। এটি শিক্ষামূলক তথ্য, কোনো চিকিৎসা রোগনির্ণয় নয়।" },
  "help.condTitle":     { en: "Conditions we screen for", bn: "যে অবস্থাগুলি আমরা স্ক্রিন করি" },
  "help.symptomsLabel": { en: "Common signs", bn: "সাধারণ লক্ষণ" },
  "help.riskLabel":     { en: "Who's at risk", bn: "কারা ঝুঁকিতে" },

  "help.normal.name":   { en: "Normal", bn: "নরমাল" },
  "help.normal.what":   { en: "A healthy retina with no signs of the conditions below. Regular screening still matters — many eye diseases develop silently before symptoms appear.", bn: "নিচের অবস্থাগুলির কোনো লক্ষণ ছাড়াই একটি সুস্থ রেটিনা। নিয়মিত স্ক্রিনিং তবুও গুরুত্বপূর্ণ — অনেক চোখের রোগ লক্ষণ দেখা দেওয়ার আগে নীরবে বিকশিত হয়।" },
  "help.normal.signs":  { en: "Clear vision, no pain, no distortion or dark spots.", bn: "পরিষ্কার দৃষ্টি, ব্যথা নেই, কোনো বিকৃতি বা কালো দাগ নেই।" },
  "help.normal.risk":   { en: "Everyone benefits from periodic eye checks, especially after age 40.", bn: "সবাই পর্যায়ক্রমিক চোখ পরীক্ষা থেকে উপকৃত হয়, বিশেষত ৪০ বছর বয়সের পরে।" },

  "help.cataract.name": { en: "Cataract", bn: "ছানি" },
  "help.cataract.what": { en: "A clouding of the eye's natural lens that gradually blurs vision. It's very common with age and is treatable with a routine surgical procedure.", bn: "চোখের প্রাকৃতিক লেন্সের একটি মেঘাচ্ছন্নতা যা ধীরে ধীরে দৃষ্টি ঝাপসা করে। এটি বয়সের সাথে খুব সাধারণ এবং একটি রুটিন অস্ত্রোপচারের মাধ্যমে চিকিৎসাযোগ্য।" },
  "help.cataract.signs": { en: "Blurry or cloudy vision, faded colours, glare or halos around lights, poor night vision.", bn: "ঝাপসা বা মেঘাচ্ছন্ন দৃষ্টি, বিবর্ণ রং, আলোর চারপাশে ঝলক বা আলোকবলয়, দুর্বল রাতের দৃষ্টি।" },
  "help.cataract.risk": { en: "Older adults, diabetes, prolonged UV exposure, smoking, and some medications.", bn: "বয়স্ক ব্যক্তি, ডায়াবেটিস, দীর্ঘস্থায়ী UV সংস্পর্শ, ধূমপান এবং কিছু ওষুধ।" },

  "help.glaucoma.name": { en: "Glaucoma", bn: "গ্লুকোমা" },
  "help.glaucoma.what": { en: "Damage to the optic nerve, often from raised pressure inside the eye. It can slowly steal peripheral vision and is a leading cause of irreversible blindness — but early detection helps protect sight.", bn: "অপটিক স্নায়ুর ক্ষতি, প্রায়শই চোখের ভিতরে বর্ধিত চাপ থেকে। এটি ধীরে ধীরে পার্শ্বীয় দৃষ্টি কেড়ে নিতে পারে এবং অপরিবর্তনীয় অন্ধত্বের একটি প্রধান কারণ — তবে প্রাথমিক সনাক্তকরণ দৃষ্টি রক্ষায় সাহায্য করে।" },
  "help.glaucoma.signs": { en: "Often none early on. Later: loss of side vision, tunnel vision; rarely eye pain and redness in acute cases.", bn: "প্রায়শই প্রথম দিকে কোনোটিই নয়। পরে: পাশের দৃষ্টি হারানো, টানেল দৃষ্টি; বিরল ক্ষেত্রে তীব্র অবস্থায় চোখে ব্যথা ও লালভাব।" },
  "help.glaucoma.risk": { en: "Family history, age over 60, high eye pressure, diabetes, and certain ethnic backgrounds.", bn: "পারিবারিক ইতিহাস, ৬০-এর বেশি বয়স, উচ্চ চোখের চাপ, ডায়াবেটিস এবং নির্দিষ্ট জাতিগত পটভূমি।" },

  "help.dr.name":       { en: "Diabetic Retinopathy", bn: "ডায়াবেটিক রেটিনোপ্যাথি" },
  "help.dr.what":       { en: "Damage to the retina's blood vessels caused by diabetes. High blood sugar over time can cause leaking, swelling, and new fragile vessels. Managing blood sugar and regular screening are key to preventing vision loss.", bn: "ডায়াবেটিসের কারণে রেটিনার রক্তনালীর ক্ষতি। সময়ের সাথে উচ্চ রক্তে শর্করা ফুটো, ফোলাভাব এবং নতুন ভঙ্গুর নালী সৃষ্টি করতে পারে। রক্তে শর্করা নিয়ন্ত্রণ ও নিয়মিত স্ক্রিনিং দৃষ্টিশক্তি হ্রাস রোধের চাবিকাঠি।" },
  "help.dr.signs":      { en: "Early: often none. Later: floaters, blurred or fluctuating vision, dark areas, impaired colour vision.", bn: "প্রথম দিকে: প্রায়শই কোনোটিই নয়। পরে: ভাসমান বস্তু, ঝাপসা বা ওঠানামা করা দৃষ্টি, কালো এলাকা, প্রতিবন্ধী রং দৃষ্টি।" },
  "help.dr.risk":       { en: "Anyone with type 1 or type 2 diabetes, especially with long duration or poor blood-sugar control.", bn: "টাইপ ১ বা টাইপ ২ ডায়াবেটিসে আক্রান্ত যে কেউ, বিশেষত দীর্ঘ সময়কাল বা দুর্বল রক্তে শর্করা নিয়ন্ত্রণের সাথে।" },

  "help.preventTitle":  { en: "Protecting your vision", bn: "আপনার দৃষ্টি রক্ষা করা" },
  "help.preventSub":    { en: "Simple habits that help keep your eyes healthy", bn: "সহজ অভ্যাস যা আপনার চোখ সুস্থ রাখতে সাহায্য করে" },
  "help.tip1.t":        { en: "Get regular eye exams", bn: "নিয়মিত চোখ পরীক্ষা করান" },
  "help.tip1.d":        { en: "A comprehensive exam can catch silent diseases early — every 1–2 years, or as your doctor advises.", bn: "একটি ব্যাপক পরীক্ষা নীরব রোগ প্রাথমিকভাবে ধরতে পারে — প্রতি ১–২ বছরে, বা আপনার ডাক্তারের পরামর্শ অনুযায়ী।" },
  "help.tip2.t":        { en: "Manage diabetes & blood pressure", bn: "ডায়াবেটিস ও রক্তচাপ নিয়ন্ত্রণ করুন" },
  "help.tip2.d":        { en: "Keeping blood sugar and pressure in range protects the delicate vessels in your retina.", bn: "রক্তে শর্করা ও চাপ সীমার মধ্যে রাখা আপনার রেটিনার সূক্ষ্ম নালীগুলিকে রক্ষা করে।" },
  "help.tip3.t":        { en: "Protect against UV light", bn: "UV আলো থেকে রক্ষা করুন" },
  "help.tip3.d":        { en: "Wear sunglasses that block UVA/UVB outdoors to lower cataract and retinal risk.", bn: "ছানি ও রেটিনার ঝুঁকি কমাতে বাইরে UVA/UVB ব্লক করে এমন সানগ্লাস পরুন।" },
  "help.tip4.t":        { en: "Rest your eyes from screens", bn: "স্ক্রিন থেকে চোখকে বিশ্রাম দিন" },
  "help.tip4.d":        { en: "Follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.", bn: "২০-২০-২০ নিয়ম মেনে চলুন: প্রতি ২০ মিনিটে, ২০ সেকেন্ডের জন্য ২০ ফুট দূরে তাকান।" },
  "help.tip5.t":        { en: "Eat for eye health", bn: "চোখের স্বাস্থ্যের জন্য খান" },
  "help.tip5.d":        { en: "Leafy greens, fish rich in omega-3, and colourful fruits support long-term eye health.", bn: "শাকসবজি, ওমেগা-৩ সমৃদ্ধ মাছ এবং রঙিন ফল দীর্ঘমেয়াদী চোখের স্বাস্থ্যকে সমর্থন করে।" },
  "help.tip6.t":        { en: "Don't smoke", bn: "ধূমপান করবেন না" },
  "help.tip6.d":        { en: "Smoking raises the risk of cataract, macular damage, and optic-nerve problems.", bn: "ধূমপান ছানি, ম্যাকুলার ক্ষতি এবং অপটিক-স্নায়ুর সমস্যার ঝুঁকি বাড়ায়।" },

  "help.howTitle":      { en: "How Smart Eye works", bn: "Smart Eye কীভাবে কাজ করে" },
  "help.howSub":        { en: "Three inputs combined into one transparent score", bn: "তিনটি ইনপুট একটি স্বচ্ছ স্কোরে একত্রিত" },
  "help.how1.t":        { en: "1 · Fundus image", bn: "১ · ফান্ডাস ছবি" },
  "help.how1.d":        { en: "A retinal photo is analysed by a CNN that estimates the chance of each of the four conditions.", bn: "একটি রেটিনার ছবি একটি CNN দ্বারা বিশ্লেষণ করা হয় যা চারটি অবস্থার প্রতিটির সম্ভাবনা অনুমান করে।" },
  "help.how2.t":        { en: "2 · Symptoms", bn: "২ · উপসর্গ" },
  "help.how2.d":        { en: "You rate symptoms like pain, redness, and blurred vision to add real-world context.", bn: "আপনি ব্যথা, লালভাব এবং ঝাপসা দৃষ্টির মতো উপসর্গ মূল্যায়ন করেন বাস্তব প্রসঙ্গ যোগ করতে।" },
  "help.how3.t":        { en: "3 · Fatigue (optional)", bn: "৩ · ক্লান্তি (ঐচ্ছিক)" },
  "help.how3.d":        { en: "An optional webcam check measures eye-aspect-ratio and blink rate for a fatigue signal.", bn: "একটি ঐচ্ছিক ওয়েবক্যাম পরীক্ষা ক্লান্তির সংকেতের জন্য আই-অ্যাসপেক্ট-রেশিও ও ব্লিঙ্ক রেট পরিমাপ করে।" },
  "help.howResult":     { en: "A fuzzy-logic engine fuses these into your Ocular Health Index (0–100) with a clear recommendation — every step is transparent and inspectable.", bn: "একটি ফাজি-লজিক ইঞ্জিন এগুলিকে আপনার চক্ষু স্বাস্থ্য সূচকে (০–১০০) একটি স্পষ্ট সুপারিশ সহ একত্রিত করে — প্রতিটি ধাপ স্বচ্ছ ও পরিদর্শনযোগ্য।" },
  "help.ctaScreen":     { en: "Start a screening", bn: "একটি স্ক্রিনিং শুরু করুন" },
  "help.disclaimer":    { en: "Smart Eye is a preliminary screening and triage support tool. It does not provide a clinical diagnosis. Always consult a qualified eye-care professional for medical concerns.", bn: "Smart Eye একটি প্রাথমিক স্ক্রিনিং ও ট্রায়াজ সহায়ক সরঞ্জাম। এটি কোনো ক্লিনিক্যাল রোগনির্ণয় প্রদান করে না। চিকিৎসা সংক্রান্ত উদ্বেগের জন্য সর্বদা একজন যোগ্য চক্ষু-বিশেষজ্ঞের পরামর্শ নিন।" },
};

const LangCtx = createContext({ lang: "en", t: (k) => k, setLang: () => {} });

function readInitialLang() {
  try {
    const saved = typeof localStorage !== "undefined" && localStorage.getItem("se_lang");
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch (_) { /* ignore */ }
  return "en";
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readInitialLang);
  const setLang = useCallback((code) => {
    setLangState(code);
    try { localStorage.setItem("se_lang", code); } catch (_) { /* ignore */ }
  }, []);
  const t = useCallback(
    (key) => {
      const entry = DICT[key];
      if (!entry) return key;            // fall back to the key if untranslated
      return entry[lang] || entry.en || key;
    },
    [lang]
  );
  return <LangCtx.Provider value={{ lang, t, setLang }}>{children}</LangCtx.Provider>;
}

export function useT() {
  return useContext(LangCtx);
}
