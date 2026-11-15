import type { Receipt } from "../../types/index.ts";
import { parseMoneyToMinorUnits } from "../expenses/calculations.ts";
import { isCurrencyCode, type CurrencyCode } from "../currency/types.ts";
import type { ExpenseRecord } from "../expenses/types.ts";

export type ReceiptExpenseDraft = Omit<ExpenseRecord, "id">;

function amountToMinorUnits(value: number, label: string, currency: CurrencyCode) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative amount.`);
  const minorUnits = parseMoneyToMinorUnits(value.toString(), currency);
  if (minorUnits === null) throw new Error(`${label} must have the correct precision for ${currency}.`);
  return minorUnits;
}

/** Converts a reviewed scanner receipt to the existing expense form's integer-cent shape. */
export function createReceiptExpenseDraft(receipt: Receipt, groupId: string, now = new Date(), currency: CurrencyCode = "USD") : ReceiptExpenseDraft {
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
      unitPriceCents: amountToMinorUnits(item.unitPrice, `Price for item ${index + 1}`, currency),
      assignedMemberIds: [],
    };
  });
  const itemSubtotalCents = items.reduce((sum, item) => {
    const next = sum + item.quantity * item.unitPriceCents;
    if (!Number.isSafeInteger(next)) throw new Error("Receipt item subtotal is too large to calculate safely.");
    return next;
  }, 0);
  const extractedSubtotalCents = amountToMinorUnits(receipt.subtotal, "Receipt subtotal", currency);
  if (itemSubtotalCents !== extractedSubtotalCents) {
    throw new Error("Item prices do not match the receipt subtotal. Correct the extracted items before continuing.");
  }
  const taxCents = amountToMinorUnits(receipt.tax, "Tax", currency);
  const tipCents = amountToMinorUnits(receipt.tip, "Tip", currency);
  const extractedTotalCents = amountToMinorUnits(receipt.total, "Charged total", currency);
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
    currency,
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
    draft.paidByMemberId === "" && (draft.currency === undefined || isCurrencyCode(draft.currency)) && typeof draft.createdAt === "string" && Number.isFinite(Date.parse(draft.createdAt)) &&
    Number.isSafeInteger(draft.taxCents) && Number(draft.taxCents) >= 0 && Number.isSafeInteger(draft.tipCents) && Number(draft.tipCents) >= 0 &&
    Array.isArray(draft.items) && draft.items.length > 0 && draft.items.every((item) => item && typeof item.id === "string" &&
      item.id.startsWith("new-item-") && typeof item.name === "string" && item.name.trim().length > 0 && Number.isInteger(item.quantity) &&
      item.quantity >= 1 && Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents >= 0 && Array.isArray(item.assignedMemberIds) &&
      item.assignedMemberIds.length === 0);
}
