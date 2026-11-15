import assert from "node:assert/strict";
import test from "node:test";
import { validateRateResponse } from "./rates.ts";

test("missing exchange rates are rejected instead of fabricated", () => {
  assert.equal(validateRateResponse({ base: "USD", rates: {}, date: "2026-11-14", fetchedAt: "2026-11-14T00:00:00Z" }).rates.EUR, undefined);
  assert.equal(validateRateResponse({ base: "USD", rates: { EUR: "1.08" }, date: "2026-11-14", fetchedAt: "2026-11-14T00:00:00Z" }).rates.EUR, "1.08");
  assert.equal(validateRateResponse({ base: "JPY", rates: { USD: "0.01" }, date: "2026-11-14", fetchedAt: "2026-11-14T00:00:00Z" }), null);
});
