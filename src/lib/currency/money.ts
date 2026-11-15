import { CURRENCY_DECIMALS, CURRENCY_LOCALES, isCurrencyCode, minorUnitFactor, type CurrencyCode } from "./types.ts";

/** Formats an integer minor-unit amount without changing the stored value. */
export function formatMinorUnits(amountMinor: number, currency: CurrencyCode, locale?: string) {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("Money must be a safe integer minor-unit amount.");
  return new Intl.NumberFormat(locale || CURRENCY_LOCALES[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: CURRENCY_DECIMALS[currency],
    maximumFractionDigits: CURRENCY_DECIMALS[currency],
  }).format(amountMinor / minorUnitFactor(currency));
}

export function majorToMinorUnits(amount: number, currency: CurrencyCode) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Money must be a non-negative number.");
  const text = String(amount);
  const decimals = CURRENCY_DECIMALS[currency];
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match || (match[2] ?? "").length > decimals) throw new Error("Amount has unsupported precision.");
  const result = Number(match[1]) * minorUnitFactor(currency) + Number((match[2] ?? "").padEnd(decimals, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("Money exceeds the supported range.");
  return result;
}

export function formatMajorUnits(amount: number, currency: CurrencyCode, locale?: string) {
  return formatMinorUnits(majorToMinorUnits(amount, currency), currency, locale);
}

function decimalRational(value: string | number) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Exchange rate must be a positive decimal.");
  const [whole, fraction = ""] = text.split(".");
  const numerator = BigInt(whole + fraction);
  const denominator = BigInt(10) ** BigInt(fraction.length);
  if (numerator <= BigInt(0)) throw new Error("Exchange rate must be positive.");
  return { numerator, denominator };
}

function roundDivide(numerator: bigint, denominator: bigint) {
  return (numerator + denominator / BigInt(2)) / denominator;
}

/** Converts integer minor units using a decimal provider rate with exact rational rounding. */
export function convertMinorUnits(amountMinor: number, from: CurrencyCode, to: CurrencyCode, rate: string | number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("Money must be a non-negative safe integer.");
  if (from === to) return amountMinor;
  const parsed = decimalRational(rate);
  const numerator = BigInt(amountMinor) * parsed.numerator * BigInt(minorUnitFactor(to));
  const denominator = parsed.denominator * BigInt(minorUnitFactor(from));
  const converted = roundDivide(numerator, denominator);
  if (converted > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Converted amount exceeds the supported range.");
  return Number(converted);
}

export function parseCurrency(value: unknown): CurrencyCode | null {
  return isCurrencyCode(value) ? value : null;
}
