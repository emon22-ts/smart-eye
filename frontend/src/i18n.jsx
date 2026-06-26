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
