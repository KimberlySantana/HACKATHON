import assert from "node:assert/strict";
import test from "node:test";
import { calculateReceiptSplit, stableReceiptUuid, validateReceiptForTransfer } from "./receipt.ts";

const review = { needsReview: false, needsConfirmation: false, confidence: "high", fields: [], notes: [] };
const receipt = {
  id: "receipt-1", groupId: "", merchant: "Cafe", date: "2026-11-14", subtotal: 3.01, tax: 0.03, tip: 0.02, total: 3.06,
  items: [
    { id: "toast", name: "Toast", quantity: 1, unitPrice: 1.01, total: 1.01, assignedMemberIds: ["a", "b"] },
    { id: "coffee", name: "Coffee", quantity: 1, unitPrice: 2, total: 2, assignedMemberIds: ["b"] },
  ],
};

test("splits a shared odd-cent item and allocates tax and tip proportionally", () => {
  const result = calculateReceiptSplit({ receipt, memberIds: ["a", "b"], tipConfirmed: true, reviewFlags: review, reviewAcknowledged: true });
  assert.equal(result.canFinalize, true);
  assert.deepEqual(result.members.map((member) => ({ id: member.memberId, items: member.itemSubtotalCents, tax: member.taxCents, tip: member.tipCents, final: member.finalCents })), [
    { id: "a", items: 51, tax: 1, tip: 0, final: 52 },
    { id: "b", items: 250, tax: 2, tip: 2, final: 254 },
  ]);
  assert.equal(result.allocatedTotalCents, 306);
});

test("requires every item to be assigned before finalization", () => {
  const result = calculateReceiptSplit({ receipt: { ...receipt, items: [{ ...receipt.items[0], assignedMemberIds: [] }, receipt.items[1]] }, memberIds: ["a", "b"], tipConfirmed: true, reviewFlags: review, reviewAcknowledged: true });
  assert.equal(result.canFinalize, false);
  assert.ok(result.reviewFlags.includes("assignment"));
});

test("does not treat a missing tip as confirmed zero", () => {
  const validation = validateReceiptForTransfer(receipt, review, false, true);
  assert.equal(validation.valid, false);
  assert.ok(validation.flags.includes("tip"));
});

test("blocks a receipt whose item subtotal and final total do not reconcile", () => {
  const validation = validateReceiptForTransfer({ ...receipt, total: 4 }, review, true, true);
  assert.equal(validation.valid, false);
  assert.ok(validation.flags.includes("total"));
});

test("stable receipt IDs prevent duplicate transfer records on retry", () => {
  const first = stableReceiptUuid("expense", "group-1", receipt.id);
  const retry = stableReceiptUuid("expense", "group-1", receipt.id);
  const otherGroup = stableReceiptUuid("expense", "group-2", receipt.id);
  assert.equal(first, retry);
  assert.notEqual(first, otherGroup);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
