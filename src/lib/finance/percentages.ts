/** Percentage rates use parts-per-million of the 100% whole: 15% = 150000. */
export const PERCENTAGE_SCALE = 1_000_000;

export type TipBasis = "pre_tax_subtotal" | "post_tax_subtotal" | "unknown";
export type TaxStatus = "amount_printed" | "percentage_printed" | "included" | "not_charged" | "unknown";
export type TaxBasis = "subtotal" | "taxable_subtotal" | "unknown";

function parseRateText(value: string | number) {
  const normalized = String(value).trim().replace(/%$/, "");
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const rate = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));
  return rate >= 0 && rate <= PERCENTAGE_SCALE ? rate : null;
}

export function parsePercentageToPpm(value: string | number) {
  return parseRateText(value);
}

function roundDivide(numerator: bigint, denominator: bigint) {
  return (numerator + denominator / BigInt(2)) / denominator;
}

/** Calculates a percentage from integer minor units with deterministic half-up rounding. */
export function calculatePercentageMinorUnits(baseMinorUnits: number, percentagePpm: number) {
  if (!Number.isSafeInteger(baseMinorUnits) || baseMinorUnits < 0) throw new Error("Percentage bases must be non-negative safe integers.");
  if (!Number.isSafeInteger(percentagePpm) || percentagePpm < 0 || percentagePpm > PERCENTAGE_SCALE) throw new Error("Percentage rates are invalid.");
  const result = roundDivide(BigInt(baseMinorUnits) * BigInt(percentagePpm), BigInt(PERCENTAGE_SCALE));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Percentage result exceeds the supported range.");
  return Number(result);
}

export function formatPercentagePpm(percentagePpm: number) {
  if (!Number.isSafeInteger(percentagePpm) || percentagePpm < 0 || percentagePpm > PERCENTAGE_SCALE) return "";
  return (percentagePpm / 10_000).toFixed(4).replace(/\.?(0+)$/, "");
}

/** Derives a display rate when switching an existing fixed amount into percentage mode. */
export function percentageFromMinorUnits(amountMinorUnits: number, baseMinorUnits: number) {
  if (!Number.isSafeInteger(amountMinorUnits) || amountMinorUnits < 0 || !Number.isSafeInteger(baseMinorUnits) || baseMinorUnits <= 0) return null;
  const rate = roundDivide(BigInt(amountMinorUnits) * BigInt(PERCENTAGE_SCALE), BigInt(baseMinorUnits));
  if (rate > BigInt(PERCENTAGE_SCALE)) return null;
  return Number(rate);
}
