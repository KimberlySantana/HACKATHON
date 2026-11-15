import type { Locale } from "../i18n/translations.ts";
import { isCurrencyCode, type CurrencyCode } from "./types.ts";

export const CURRENCY_PREFERENCES_KEY = "splitzy-currency-preferences";

export type CurrencyPreferences = {
  displayCurrency: CurrencyCode | null;
  conversionsEnabled: boolean;
};

export const DEFAULT_CURRENCY_PREFERENCES: CurrencyPreferences = {
  displayCurrency: null,
  conversionsEnabled: false,
};

export function suggestedCurrencyForLocale(locale: Locale): CurrencyCode {
  if (locale === "es" || locale === "it") return "EUR";
  if (locale === "zh") return "CNY";
  if (locale === "ko") return "KRW";
  return "USD";
}

export function parseCurrencyPreferences(serialized: string | null): CurrencyPreferences {
  if (!serialized) return DEFAULT_CURRENCY_PREFERENCES;
  try {
    const value = JSON.parse(serialized) as Partial<CurrencyPreferences>;
    return {
      displayCurrency: value.displayCurrency === null || isCurrencyCode(value.displayCurrency) ? value.displayCurrency : null,
      conversionsEnabled: value.conversionsEnabled === true,
    };
  } catch {
    return DEFAULT_CURRENCY_PREFERENCES;
  }
}

export function serializeCurrencyPreferences(preferences: CurrencyPreferences) {
  return JSON.stringify(preferences);
}
