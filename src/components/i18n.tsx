"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { locales, translate, type Locale, type TranslationKey } from "@/lib/i18n/translations";

const LANGUAGE_STORAGE_KEY = "splitzy-language";

const languageOptions: Array<{ value: Locale; label: string }> = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "zh", label: "中文" },
  { value: "ko", label: "한국어" },
];

type LanguageContextValue = {
  locale: Locale;
  hydrated: boolean;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLocale && locales.includes(savedLocale as Locale)) {
        setLocaleState(savedLocale as Locale);
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale); } catch { /* The interface still switches if storage is unavailable. */ }
  }

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    hydrated,
    setLocale,
    t: (key, values) => translate(locale, key, values),
  }), [hydrated, locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider.");
  return context;
}

export function LanguageSwitcher() {
  const { locale, hydrated, setLocale, t } = useLanguage();

  return (
    <label className="group inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-white px-3 shadow-[0_4px_12px_rgba(31,50,77,0.04)] transition hover:border-[#b8c9dc] hover:bg-[#f8fbfd] focus-within:ring-4 focus-within:ring-ring/10">
      <span className="text-sm" aria-hidden="true">🌐</span>
      <span className="sr-only">{t("language.selectLabel")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        disabled={!hydrated}
        aria-label={t("language.selectLabel")}
        className="cursor-pointer appearance-none bg-transparent py-2 pr-1 text-xs font-bold text-primary outline-none disabled:cursor-wait disabled:opacity-60"
      >
        {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select><span className="text-[10px] text-accent transition group-hover:translate-y-0.5" aria-hidden="true">⌄</span>
    </label>
  );
}
