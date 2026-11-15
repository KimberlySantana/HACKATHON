"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLanguage } from "@/components/i18n";
import { parseCurrencyPreferences, serializeCurrencyPreferences, suggestedCurrencyForLocale, CURRENCY_PREFERENCES_KEY, type CurrencyPreferences } from "@/lib/currency/preferences";
import { CURRENCY_CODES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/currency/types";
import { convertMinorUnits, formatMinorUnits } from "@/lib/currency/money";
import { validateRateResponse, type RateResponse } from "@/lib/currency/rates";

type CurrencyContextValue = CurrencyPreferences & {
  hydrated: boolean;
  suggestedCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode | null) => void;
  setConversionsEnabled: (enabled: boolean) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const rateCache = new Map<string, Promise<RateResponse | null>>();

function loadRates(base: CurrencyCode, target: CurrencyCode) {
  const key = `${base}:${target}`;
  const cached = rateCache.get(key);
  if (cached) return cached;
  const request = fetch(`/api/currency/rates?base=${base}&symbols=${target}`)
    .then((response) => response.ok ? response.json() : Promise.reject(new Error("rate unavailable")))
    .then((value) => validateRateResponse(value))
    .catch(() => null);
  rateCache.set(key, request);
  return request;
}

export function CurrencyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = useLanguage();
  const [preferences, setPreferences] = useState<CurrencyPreferences>({ displayCurrency: null, conversionsEnabled: false });
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      setPreferences(parseCurrencyPreferences(window.localStorage.getItem(CURRENCY_PREFERENCES_KEY)));
    } finally {
      setHydrated(true);
    }
  }, []);
  useEffect(() => {
    if (hydrated) {
      try { window.localStorage.setItem(CURRENCY_PREFERENCES_KEY, serializeCurrencyPreferences(preferences)); } catch { /* The display preference remains active for this session. */ }
    }
  }, [hydrated, preferences]);

  const value = useMemo(() => ({
    ...preferences,
    hydrated,
    suggestedCurrency: suggestedCurrencyForLocale(locale),
    setDisplayCurrency: (displayCurrency: CurrencyCode | null) => setPreferences((current) => ({ ...current, displayCurrency })),
    setConversionsEnabled: (conversionsEnabled: boolean) => setPreferences((current) => ({ ...current, conversionsEnabled })),
  }), [hydrated, locale, preferences]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used inside CurrencyProvider.");
  return context;
}

export function CurrencySwitcher() {
  const { displayCurrency, conversionsEnabled, hydrated, suggestedCurrency, setDisplayCurrency, setConversionsEnabled } = useCurrency();
  const { t } = useLanguage();
  return <div className="flex flex-wrap items-center gap-2">
    <label className="group inline-flex min-h-10 items-center gap-2 rounded-full border border-[#ead8ce] bg-[#fff8f4] px-3 shadow-[0_8px_20px_rgba(177,104,78,0.08)] transition hover:-translate-y-0.5 hover:border-[#ed795d] hover:bg-white focus-within:ring-4 focus-within:ring-[#ed795d]/10">
      <span aria-hidden="true">💱</span><span className="sr-only">{t("currency.select")}</span>
      <select value={displayCurrency ?? "original"} onChange={(event) => setDisplayCurrency(event.target.value === "original" ? null : event.target.value as CurrencyCode)} disabled={!hydrated} aria-label={t("currency.select")} className="max-w-[9rem] cursor-pointer appearance-none bg-transparent py-2 pr-1 text-xs font-extrabold text-[#8b5f52] outline-none disabled:cursor-wait disabled:opacity-60">
        <option value="original">{t("currency.original")}</option>
        {CURRENCY_CODES.map((code) => <option key={code} value={code}>{CURRENCY_LABELS[code]}{code === suggestedCurrency ? ` · ${t("currency.suggestion")}` : ""}</option>)}
      </select><span className="text-[10px] text-[#ed795d]" aria-hidden="true">⌄</span>
    </label>
    <label className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#ead8ce] bg-white/80 px-3 text-xs font-extrabold text-[#8b5f52]">
      <input type="checkbox" checked={conversionsEnabled} onChange={(event) => setConversionsEnabled(event.target.checked)} disabled={!hydrated} className="accent-[#ed795d] disabled:cursor-wait" />
      {t("currency.conversions")}
    </label>
  </div>;
}

type CurrencyAmountProps = { amountMinor: number; originalCurrency: CurrencyCode; className?: string };

export function CurrencyAmount({ amountMinor, originalCurrency, className }: CurrencyAmountProps) {
  const { displayCurrency, conversionsEnabled } = useCurrency();
  const { locale, t } = useLanguage();
  const [rateData, setRateData] = useState<RateResponse | null>(null);
  const [rateError, setRateError] = useState(false);
  const target = displayCurrency && displayCurrency !== originalCurrency ? displayCurrency : null;

  useEffect(() => {
    let cancelled = false;
    setRateData(null);
    if (!conversionsEnabled || !target) { setRateError(false); return; }
    setRateError(false);
    loadRates(originalCurrency, target)
      .then((parsed) => { if (!cancelled) { if (parsed) setRateData(parsed); else setRateError(true); } });
    return () => { cancelled = true; };
  }, [conversionsEnabled, originalCurrency, target]);

  const original = formatMinorUnits(amountMinor, originalCurrency, locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : locale);
  if (!target || !conversionsEnabled) return <span className={className}>{original}</span>;
  const rate = rateData?.rates[target];
  if (!rate || rateError) return <span className={className} title={t("currency.rateUnavailable")}>{original} <span className="text-xs font-semibold text-[#a64531]">({t("currency.rateUnavailable")})</span></span>;
  const converted = convertMinorUnits(amountMinor, originalCurrency, target, rate);
  return <span className={className}><span>{original}</span><span className="ml-2 text-sm font-semibold text-[#8b5f52]">≈ {formatMinorUnits(converted, target, locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : locale)} <span className="text-xs">{t("currency.approx")}</span></span><span className="mt-0.5 block text-[10px] font-semibold text-[#aaa69c]">{t("currency.rate")}: 1 {originalCurrency} = {rate} {target} · {t("currency.lastUpdated")}: {rateData.date}</span></span>;
}
