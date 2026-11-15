import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePercentageMinorUnits,
  formatPercentagePpm,
  parsePercentageToPpm,
  percentageFromMinorUnits,
} from "./percentages.ts";

test("parses and formats percentage rates without floating-point drift", () => {
  assert.equal(parsePercentageToPpm("15%"), 150000);
  assert.equal(parsePercentageToPpm("8.875"), 88750);
  assert.equal(formatPercentagePpm(150000), "15");
  assert.equal(formatPercentagePpm(88750), "8.875");
});

test("calculates pre-tax and post-tax tip bases with integer arithmetic", () => {
  const preTaxSubtotalCents = 1000;
  const taxCents = calculatePercentageMinorUnits(preTaxSubtotalCents, parsePercentageToPpm("8.25"));
  const preTaxTipCents = calculatePercentageMinorUnits(preTaxSubtotalCents, parsePercentageToPpm("20"));
  const postTaxTipCents = calculatePercentageMinorUnits(preTaxSubtotalCents + taxCents, parsePercentageToPpm("20"));

  assert.equal(taxCents, 83);
  assert.equal(preTaxTipCents, 200);
  assert.equal(postTaxTipCents, 217);
});

test("uses deterministic half-up cent rounding", () => {
  assert.equal(calculatePercentageMinorUnits(1, parsePercentageToPpm("50")), 1);
  assert.equal(calculatePercentageMinorUnits(3, parsePercentageToPpm("50")), 2);
  assert.equal(calculatePercentageMinorUnits(100, parsePercentageToPpm("0.01")), 0);
  assert.equal(calculatePercentageMinorUnits(1234, parsePercentageToPpm("15")), 185);
});

test("rejects missing or unsafe rates and bases", () => {
  assert.equal(parsePercentageToPpm(""), null);
  assert.equal(parsePercentageToPpm("101"), null);
  assert.equal(parsePercentageToPpm("not-a-rate"), null);
  assert.equal(percentageFromMinorUnits(100, 0), null);
  assert.throws(() => calculatePercentageMinorUnits(-1, 150000));
  assert.throws(() => calculatePercentageMinorUnits(100, 1_000_001));
});

test("derives a display rate when switching a fixed amount to percentage mode", () => {
  assert.equal(percentageFromMinorUnits(200, 1000), 200000);
  assert.equal(formatPercentagePpm(percentageFromMinorUnits(200, 1000)), "20");
});
