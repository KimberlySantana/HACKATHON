import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from "./types.ts";

export type RateResponse = {
  base: CurrencyCode;
  rates: Partial<Record<CurrencyCode, string>>;
  date: string;
  fetchedAt: string;
};

export function validateRateResponse(value: unknown): RateResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<RateResponse> & { rates?: Record<string, unknown> };
  if (!isCurrencyCode(candidate.base) || typeof candidate.date !== "string" || typeof candidate.fetchedAt !== "string" || !candidate.rates) return null;
  const rates: Partial<Record<CurrencyCode, string>> = {};
  for (const code of CURRENCY_CODES) {
    const rate = candidate.rates[code];
    if (typeof rate === "string" && /^\d+(?:\.\d+)?$/.test(rate)) rates[code] = rate;
  }
  return { base: candidate.base, rates, date: candidate.date, fetchedAt: candidate.fetchedAt };
}
