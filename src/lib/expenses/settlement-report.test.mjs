import assert from "node:assert/strict";
import test from "node:test";
import { calculateSettlement } from "./calculations.ts";
import { buildSettlementReport } from "./settlement-report.ts";

function expense(id, paidByMemberId, amountCents, assignedMemberIds = ["a", "b"]) {
  return {
    id,
    groupId: "group-1",
    description: `Expense ${id}`,
    paidByMemberId,
    items: [{ id: `${id}-item`, name: "Shared item", quantity: 1, unitPriceCents: amountCents, assignedMemberIds }],
    taxCents: 7,
    tipCents: 5,
    currency: "USD",
    createdAt: "2026-11-14T00:00:00.000Z",
  };
}

test("builds a report from exact settlement shares and preserves charge breakdowns", () => {
  const members = [{ id: "a", name: "Alex" }, { id: "b", name: "Blair" }];
  const expenses = [expense("one", "a", 101)];
  const totals = calculateSettlement(expenses, members);
  const report = buildSettlementReport("Dinner crew", expenses, members, totals, new Date("2026-11-14T00:00:00.000Z"));

  assert.equal(report.totalExpensesCents, 113);
  assert.equal(report.totalTaxCents, 7);
  assert.equal(report.totalTipCents, 5);
  assert.deepEqual(report.members.map(({ name, shareCents }) => ({ name, shareCents })), [
    { name: "Alex", shareCents: 58 },
    { name: "Blair", shareCents: 55 },
  ]);
  assert.equal(report.expenses[0].items[0].totalCents, 101);
  assert.equal(report.transfers[0].amountCents, 55);
});

test("supports larger reports without changing the calculated totals", () => {
  const members = Array.from({ length: 12 }, (_, index) => ({ id: `m${index}`, name: `Member ${index + 1}` }));
  const expenses = Array.from({ length: 10 }, (_, index) => expense(`expense-${index}`, members[index % 2].id, 100 + index, [members[index % members.length].id]));
  const totals = calculateSettlement(expenses, members);
  const report = buildSettlementReport("Large dinner group", expenses, members, totals);

  assert.equal(report.expenses.length, 10);
  assert.equal(report.members.length, 12);
  assert.equal(report.totalExpensesCents, report.members.reduce((sum, member) => sum + member.shareCents, 0));
  assert.equal(report.totalExpensesCents, expenses.reduce((sum, item) => sum + item.items[0].unitPriceCents + 12, 0));
});
