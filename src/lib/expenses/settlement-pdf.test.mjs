import assert from "node:assert/strict";
import test from "node:test";
import { settlementEmailHref, settlementPdfPageCount, settlementSmsHref } from "./settlement-pdf.ts";

const baseReport = { groupName: "Dinner", generatedAt: "2026-11-15T00:00:00.000Z", currency: "USD", totalExpensesCents: 0, totalTaxCents: 0, totalTipCents: 0, expenses: [], members: [], transfers: [] };

test("uses one PDF page for a simple settlement", () => {
  assert.equal(settlementPdfPageCount(baseReport), 1);
});

test("plans multiple PDF pages for larger expense lists", () => {
  const report = { ...baseReport, expenses: Array.from({ length: 10 }, (_, index) => ({ id: String(index), description: "Dinner", paidBy: "Alex", items: [], subtotalCents: 0, taxCents: 0, tipCents: 0, totalCents: 0 })) };
  assert.equal(settlementPdfPageCount(report), 4);
});

test("creates email and SMS fallbacks with summary text only", () => {
  const report = { ...baseReport, groupName: "Dinner & Drinks", totalExpensesCents: 1250, members: [{ id: "a", name: "Alex", shareCents: 1250, balanceCents: 0 }] };
  const labels = { title: "Share settlement", subtitle: "Group settlement summary", generatedOn: "Generated", originalCurrency: "Original currency", totalExpenses: "Total expenses", itemizedExpenses: "Itemized expenses", memberShares: "Member shares", whoOwesWhom: "Who owes whom", outstandingTransfers: "Outstanding transfers", noOutstandingTransfers: "Everyone is settled up.", paidBy: "Paid by", items: "Items", subtotal: "Subtotal", tax: "Tax", tip: "Tip", total: "Total", paymentTracking: "Payment confirmations are not stored yet." };
  const emailHref = settlementEmailHref(report, labels, "en");
  const smsHref = settlementSmsHref(report, labels, "en");
  assert.match(emailHref, /^mailto:\?subject=/);
  assert.match(emailHref, /body=/);
  assert.match(smsHref, /^sms:\?body=/);
  assert.ok(decodeURIComponent(emailHref).includes("Dinner & Drinks"));
  assert.ok(decodeURIComponent(smsHref).includes("Total expenses"));
});
