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
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLocale && locales.includes(savedLocale as Locale)) {
      setLocaleState(savedLocale as Locale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : locale;
  }, [locale]);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
  }

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale,
    t: (key, values) => translate(locale, key, values),
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider.");
  return context;
}

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <label className="group inline-flex min-h-10 items-center gap-2 rounded-full border border-[#ead8ce] bg-[#fff8f4] px-3 shadow-[0_8px_20px_rgba(177,104,78,0.08)] transition hover:-translate-y-0.5 hover:border-[#ed795d] hover:bg-white focus-within:ring-4 focus-within:ring-[#ed795d]/10">
      <span className="text-sm" aria-hidden="true">🌐</span>
      <span className="sr-only">{t("language.selectLabel")}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("language.selectLabel")}
        className="cursor-pointer appearance-none bg-transparent py-2 pr-1 text-xs font-extrabold text-[#8b5f52] outline-none"
      >
        {languageOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className="text-[10px] text-[#ed795d] transition group-hover:translate-y-0.5" aria-hidden="true">⌄</span>
    </label>
  );
}
