import assert from "node:assert/strict";
import test from "node:test";
import { buildSettlementCopySummary } from "./settlement-sharing.ts";

test("settlement summary includes group name and only calculated transfers", () => {
  const summary = buildSettlementCopySummary("Cabin weekend", [
    { fromMemberId: "amy", toMemberId: "bella", amountCents: 1250 },
  ], [
    { id: "amy", name: "Amy" },
    { id: "bella", name: "Bella" },
  ]);

  assert.equal(summary, "Splitzy · Cabin weekend\n\nAmy pays Bella $12.50");
});

test("zero calculated transfers do not invent balances or payment status", () => {
  assert.equal(buildSettlementCopySummary("Dinner", [], [{ id: "amy", name: "Amy" }]), "Splitzy · Dinner\n\nNo transfers are needed.");
});
