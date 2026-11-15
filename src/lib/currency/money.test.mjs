import assert from "node:assert/strict";
import test from "node:test";
import { convertMinorUnits, formatMinorUnits } from "./money.ts";

test("formats currencies with currency-aware minor units", () => {
  assert.match(formatMinorUnits(1234, "USD", "en-US"), /\$12\.34/);
  assert.match(formatMinorUnits(1234, "EUR", "de-DE"), /12,34/);
  assert.match(formatMinorUnits(1234, "KRW", "ko-KR"), /₩1,234/);
});

test("converts with exact rational rounding and zero-decimal KRW", () => {
  assert.equal(convertMinorUnits(100, "USD", "KRW", "1300.25"), 1300);
  assert.equal(convertMinorUnits(1, "USD", "KRW", "1300.25"), 13);
  assert.equal(convertMinorUnits(10000, "KRW", "USD", "0.00076908"), 769);
});

test("same-currency conversion preserves the original minor units", () => {
  assert.equal(convertMinorUnits(123, "CNY", "CNY", "999"), 123);
});
