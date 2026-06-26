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
