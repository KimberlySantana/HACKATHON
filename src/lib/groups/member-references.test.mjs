import test from "node:test";
import assert from "node:assert/strict";
import { findReferencedMembers } from "./member-references.ts";

const expense = {
  id: "expense-1",
  groupId: "group-1",
  description: "Dinner",
  paidByMemberId: "maya",
  items: [{ id: "item-1", name: "Pasta", quantity: 1, unitPriceCents: 1800, assignedMemberIds: ["jules"] }],
  taxCents: 100,
  tipCents: 200,
  createdAt: "2026-11-14T00:00:00.000Z",
};

test("finds members referenced as an expense payer or item assignee", () => {
  assert.deepEqual(findReferencedMembers(["maya", "jules", "alex"], [expense]), ["maya", "jules"]);
});

test("does not block removal when expenses do not reference a member", () => {
  assert.deepEqual(findReferencedMembers(["alex"], [expense]), []);
});
