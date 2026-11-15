import assert from "node:assert/strict";
import test from "node:test";
import { buildPaymentReminder } from "./payment-reminders.ts";

const details = {
  groupName: "Lake weekend",
  transfer: { fromMemberId: "amy", toMemberId: "bella", amountCents: 1250 },
  fromName: "Amy",
  toName: "Bella",
};

test("all English reminder tones use the actual transfer and group", () => {
  for (const tone of ["friendly", "polite", "direct", "funny"]) {
    const message = buildPaymentReminder({ ...details, tone, language: "en" });
    assert.match(message, /Bella/);
    assert.match(message, /Amy/);
    assert.match(message, /\$12\.50/);
    assert.match(message, /Lake weekend/);
  }
});

test("all Traditional Chinese tones include actual names, amount, and group", () => {
  for (const tone of ["friendly", "polite", "direct", "funny"]) {
    const message = buildPaymentReminder({ ...details, tone, language: "zh-TW" });
    assert.match(message, /Bella/);
    assert.match(message, /Amy/);
    assert.match(message, /\$12\.50/);
    assert.match(message, /Lake weekend/);
  }
});

test("reminder content is based only on the selected transfer amount", () => {
  const message = buildPaymentReminder({ ...details, tone: "direct", language: "en" });
  assert.match(message, /\$12\.50/);
  assert.doesNotMatch(message, /paid|completed|settled/i);
});
