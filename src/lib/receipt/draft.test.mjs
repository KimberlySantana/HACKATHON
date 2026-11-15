import assert from "node:assert/strict";
import test from "node:test";
import { createReceiptExpenseDraft, receiptDraftStorageKey } from "./draft.ts";

const receipt = {
  id: "receipt-1", groupId: "", merchant: "Cafe", date: "2026-11-14", subtotal: 8.5, tax: 0.68, tip: 1.7, total: 10.88,
  items: [{ id: "item-1", name: "Tea", quantity: 2, unitPrice: 3.25, total: 6.5, assignedMemberIds: ["stale-member"] }, { id: "item-2", name: "Cake", quantity: 1, unitPrice: 2, total: 2, assignedMemberIds: [] }],
};

test("receipt handoff converts currency once to cents and leaves payer and assignments unset", () => {
  const draft = createReceiptExpenseDraft(receipt, "group-1", new Date("2026-11-15T12:00:00Z"));
  assert.equal(draft.groupId, "group-1");
  assert.equal(draft.description, "Cafe");
  assert.equal(draft.paidByMemberId, "");
  assert.equal(draft.items[0].unitPriceCents, 325);
  assert.equal(draft.items[1].unitPriceCents, 200);
  assert.equal(draft.items[0].assignedMemberIds.length, 0);
  assert.equal(draft.items[1].assignedMemberIds.length, 0);
  assert.equal(draft.taxCents, 68);
  assert.equal(draft.tipCents, 170);
  assert.equal(draft.createdAt, "2026-11-14T12:00:00.000Z");
  assert.match(draft.items[0].id, /^new-item-/);
});

test("receipt handoff rejects invalid prices, quantities, names, and empty receipts", () => {
  assert.throws(() => createReceiptExpenseDraft({ ...receipt, items: [] }, "group-1"), /at least one receipt item/);
  assert.throws(() => createReceiptExpenseDraft({ ...receipt, items: [{ ...receipt.items[0], quantity: 1.5 }] }, "group-1"), /whole-number quantity/);
  assert.throws(() => createReceiptExpenseDraft({ ...receipt, items: [{ ...receipt.items[0], unitPrice: 1.234 }] }, "group-1"), /no more than two decimal places/);
  assert.throws(() => createReceiptExpenseDraft({ ...receipt, merchant: " " }, "group-1"), /merchant or expense name/);
});

test("receipt draft keys are isolated by group", () => {
  assert.notEqual(receiptDraftStorageKey("group-a"), receiptDraftStorageKey("group-b"));
});
