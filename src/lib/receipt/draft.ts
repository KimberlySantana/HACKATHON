import type { Receipt } from "../../types/index.ts";
import { parseMoneyToCents } from "../expenses/calculations.ts";
import type { ExpenseRecord } from "../expenses/types.ts";

export type ReceiptExpenseDraft = Omit<ExpenseRecord, "id">;

function dollarsToCents(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative amount.`);
  const cents = parseMoneyToCents(value.toString());
  if (cents === null) throw new Error(`${label} must be a dollar amount with no more than two decimal places.`);
  return cents;
}

/** Converts a reviewed scanner receipt to the existing expense form's integer-cent shape. */
export function createReceiptExpenseDraft(receipt: Receipt, groupId: string, now = new Date()) : ReceiptExpenseDraft {
  if (!groupId.trim()) throw new Error("Choose a group before splitting a receipt.");
  const description = receipt.merchant.trim();
  if (!description) throw new Error("Enter a merchant or expense name before continuing.");
  if (receipt.items.length === 0) throw new Error("Add at least one receipt item before continuing.");

  const items = receipt.items.map((item, index) => {
    if (!item.name.trim()) throw new Error(`Enter a name for item ${index + 1}.`);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw new Error(`Use a whole-number quantity from 1 to 999 for item ${index + 1}.`);
    return {
      id: `new-item-${index + 1}`,
      name: item.name.trim(),
      quantity: item.quantity,
      unitPriceCents: dollarsToCents(item.unitPrice, `Price for item ${index + 1}`),
      assignedMemberIds: [],
    };
  });
  const itemSubtotalCents = items.reduce((sum, item) => {
    const next = sum + item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(next)) throw new Error("Receipt item subtotal is too large to calculate safely.");
    return next;
  }, 0);
  const extractedSubtotalCents = dollarsToCents(receipt.subtotal, "Receipt subtotal");
  if (itemSubtotalCents !== extractedSubtotalCents) {
    throw new Error("Item prices do not match the receipt subtotal. Correct the extracted items before continuing.");
  }
  const taxCents = dollarsToCents(receipt.tax, "Tax");
  const tipCents = dollarsToCents(receipt.tip, "Tip");
  const extractedTotalCents = dollarsToCents(receipt.total, "Charged total");
  if (itemSubtotalCents + taxCents + tipCents !== extractedTotalCents) {
    throw new Error("Item prices, tax, and tip do not match the charged total. Review the receipt before continuing.");
  }

  const createdAt = /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) && !Number.isNaN(Date.parse(`${receipt.date}T12:00:00.000Z`))
    ? `${receipt.date}T12:00:00.000Z`
    : now.toISOString();

  return {
    groupId,
    description,
    paidByMemberId: "",
    items,
    taxCents,
    tipCents,
    createdAt,
  };
}

export function receiptDraftStorageKey(groupId: string) {
  return `splitzy:receipt-expense-draft:${groupId}`;
}

export function isReceiptExpenseDraft(value: unknown, groupId: string): value is ReceiptExpenseDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ReceiptExpenseDraft>;
  return draft.groupId === groupId && typeof draft.description === "string" && draft.description.trim().length > 0 &&
    draft.paidByMemberId === "" && typeof draft.createdAt === "string" && Number.isFinite(Date.parse(draft.createdAt)) &&
    Number.isSafeInteger(draft.taxCents) && Number(draft.taxCents) >= 0 && Number.isSafeInteger(draft.tipCents) && Number(draft.tipCents) >= 0 &&
    Array.isArray(draft.items) && draft.items.length > 0 && draft.items.every((item) => item && typeof item.id === "string" &&
      item.id.startsWith("new-item-") && typeof item.name === "string" && item.name.trim().length > 0 && Number.isInteger(item.quantity) &&
      item.quantity >= 1 && Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents >= 0 && Array.isArray(item.assignedMemberIds) &&
      item.assignedMemberIds.length === 0);
}
