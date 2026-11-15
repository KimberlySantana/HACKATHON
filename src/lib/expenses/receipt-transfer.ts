import type { Receipt } from "@/types";
import type { ReceiptReview } from "@/lib/receipt/extraction";
import { stableReceiptUuid } from "@/lib/splitting/receipt";

export const RECEIPT_TRANSFER_STORAGE_KEY = "splitzy.receipt-transfer.v1";

export type PendingReceiptTransfer = {
  version: 1;
  transferId: string;
  groupId: string;
  receipt: Receipt;
  reviewFlags: ReceiptReview;
  tipConfirmed: boolean;
  reviewAcknowledged: boolean;
  expenseId: string;
};

export function receiptExpenseId(groupId: string, receiptId: string) {
  return stableReceiptUuid("expense", groupId, receiptId);
}

export function receiptItemId(groupId: string, receiptId: string, itemId: string) {
  return stableReceiptUuid("item", groupId, receiptId, itemId);
}

export function createReceiptTransfer(
  groupId: string,
  receipt: Receipt,
  reviewFlags: ReceiptReview,
  tipConfirmed: boolean,
  reviewAcknowledged: boolean,
): PendingReceiptTransfer {
  return {
    version: 1,
    transferId: stableReceiptUuid("transfer", groupId, receipt.id),
    groupId,
    receipt,
    reviewFlags,
    tipConfirmed,
    reviewAcknowledged,
    expenseId: receiptExpenseId(groupId, receipt.id),
  };
}

export function saveReceiptTransfer(transfer: PendingReceiptTransfer) {
  window.sessionStorage.setItem(RECEIPT_TRANSFER_STORAGE_KEY, JSON.stringify(transfer));
}

function isReview(value: unknown): value is ReceiptReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<ReceiptReview>;
  return typeof review.needsReview === "boolean" && typeof review.needsConfirmation === "boolean" &&
    (review.confidence === "high" || review.confidence === "medium" || review.confidence === "low") &&
    Array.isArray(review.fields) && review.fields.every((field) => typeof field === "string") &&
    Array.isArray(review.notes) && review.notes.every((note) => typeof note === "string");
}

function isReceipt(value: unknown): value is Receipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Partial<Receipt>;
  return typeof receipt.id === "string" && typeof receipt.merchant === "string" && typeof receipt.date === "string" &&
    typeof receipt.subtotal === "number" && typeof receipt.tax === "number" && typeof receipt.tip === "number" && typeof receipt.total === "number" &&
    Array.isArray(receipt.items) && receipt.items.every((item) => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<Receipt["items"][number]>;
      return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.quantity === "number" &&
        typeof candidate.unitPrice === "number" && typeof candidate.total === "number" && Array.isArray(candidate.assignedMemberIds) &&
        candidate.assignedMemberIds.every((memberId) => typeof memberId === "string");
    });
}

export function readReceiptTransfer(groupId: string, receiptId?: string) {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(RECEIPT_TRANSFER_STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const transfer = value as Partial<PendingReceiptTransfer>;
    if (transfer.version !== 1 || transfer.groupId !== groupId || (receiptId && transfer.receipt?.id !== receiptId) ||
      typeof transfer.transferId !== "string" || typeof transfer.expenseId !== "string" || !isReceipt(transfer.receipt) ||
      !isReview(transfer.reviewFlags) || typeof transfer.tipConfirmed !== "boolean" || typeof transfer.reviewAcknowledged !== "boolean") return null;
    return transfer as PendingReceiptTransfer;
  } catch {
    return null;
  }
}

export function clearReceiptTransfer(transferId?: string) {
  if (typeof window === "undefined") return;
  if (!transferId) { window.sessionStorage.removeItem(RECEIPT_TRANSFER_STORAGE_KEY); return; }
  try {
    const current = JSON.parse(window.sessionStorage.getItem(RECEIPT_TRANSFER_STORAGE_KEY) ?? "null") as Partial<PendingReceiptTransfer> | null;
    if (current?.transferId === transferId) window.sessionStorage.removeItem(RECEIPT_TRANSFER_STORAGE_KEY);
  } catch { /* A malformed pending transfer is safe to leave for the next read to ignore. */ }
}
