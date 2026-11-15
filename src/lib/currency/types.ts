export const CURRENCY_CODES = ["USD", "EUR", "CNY", "KRW"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  USD: 2,
  EUR: 2,
  CNY: 2,
  KRW: 0,
};

export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  USD: "en-US",
  EUR: "de-DE",
  CNY: "zh-CN",
  KRW: "ko-KR",
};

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "USD — US Dollar",
  EUR: "EUR — Euro",
  CNY: "CNY — Chinese Yuan",
  KRW: "KRW — South Korean Won",
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

export function minorUnitFactor(currency: CurrencyCode) {
  return 10 ** CURRENCY_DECIMALS[currency];
}
