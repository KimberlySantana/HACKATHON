import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CURRENCY_PREFERENCES, parseCurrencyPreferences, serializeCurrencyPreferences, suggestedCurrencyForLocale } from "./preferences.ts";

test("currency preferences persist independently from language", () => {
  const value = { displayCurrency: "KRW", conversionsEnabled: true };
  assert.deepEqual(parseCurrencyPreferences(serializeCurrencyPreferences(value)), value);
  assert.deepEqual(parseCurrencyPreferences(null), DEFAULT_CURRENCY_PREFERENCES);
});

test("language only provides a suggestion and never changes an explicit selection", () => {
  assert.equal(suggestedCurrencyForLocale("zh"), "CNY");
  assert.equal(parseCurrencyPreferences(JSON.stringify({ displayCurrency: "EUR", conversionsEnabled: true })).displayCurrency, "EUR");
});

test("malformed or unsupported preferences fall back safely", () => {
  assert.deepEqual(parseCurrencyPreferences("not-json"), DEFAULT_CURRENCY_PREFERENCES);
  assert.deepEqual(parseCurrencyPreferences(JSON.stringify({ displayCurrency: "JPY", conversionsEnabled: true })), { displayCurrency: null, conversionsEnabled: true });
});
