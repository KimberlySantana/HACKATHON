import type { Receipt, ReceiptItem } from "@/types";
import type { ReceiptReview } from "@/lib/receipt/extraction";
import { CURRENCY_DECIMALS, isCurrencyCode, type CurrencyCode } from "../currency/types.ts";

export type ReceiptAdjustment = {
  id: string;
  kind: "discount" | "service_charge";
  label: string;
  amountCents: number;
  includedInSubtotal: boolean;
  includedInTotal: boolean;
  confirmed: boolean;
};

export type SplitReceiptInput = {
  receipt: Receipt;
  memberIds: string[];
  tipConfirmed: boolean;
  reviewFlags: Pick<ReceiptReview, "needsReview" | "needsConfirmation" | "fields" | "notes">;
  reviewAcknowledged?: boolean;
  adjustments?: ReceiptAdjustment[];
};

export type MemberBreakdown = {
  memberId: string;
  basisCents: number;
  proportionBps: number;
  items: Array<{ itemId: string; name: string; amountCents: number }>;
  itemSubtotalCents: number;
  taxCents: number;
  tipCents: number;
  adjustmentCents: number;
  finalCents: number;
};

export type SplitResult = {
  receiptId: string;
  currency: CurrencyCode;
  canFinalize: boolean;
  receiptTotalCents: number;
  allocatedTotalCents: number;
  totalsMatch: boolean;
  reviewFlags: string[];
  reviewNotes: string[];
  members: MemberBreakdown[];
};

export type ReceiptTransferValidation = {
  valid: boolean;
  flags: string[];
  notes: string[];
  receiptSubtotalCents: number | null;
  receiptTotalCents: number | null;
};

function minorUnits(amount: number, currency: CurrencyCode): number | null {
  if (!Number.isFinite(amount) || amount < 0) return null;
  const decimals = CURRENCY_DECIMALS[currency];
  const text = String(amount);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match || (match[2] ?? "").length > decimals) return null;
  const value = Number(match[1]) * 10 ** decimals + Number((match[2] ?? "").padEnd(decimals, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

function lineTotalCents(item: ReceiptItem, currency: CurrencyCode): number | null {
  if (!Number.isInteger(item.quantity) || item.quantity < 1) return null;
  const unitPriceCents = minorUnits(item.unitPrice, currency);
  if (unitPriceCents === null) return null;
  const lineTotal = unitPriceCents * item.quantity;
  return Number.isSafeInteger(lineTotal) ? lineTotal : null;
}

function splitEvenly(amountCents: number, memberIds: string[]) {
  const base = Math.floor(amountCents / memberIds.length);
  let remainder = amountCents % memberIds.length;
  return new Map(memberIds.map((memberId) => {
    const share = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return [memberId, share] as const;
  }));
}

function allocateProportionally(amountCents: number, weights: Map<string, number>, memberIds: string[]) {
  const weightTotal = memberIds.reduce((sum, id) => sum + (weights.get(id) ?? 0), 0);
  const allocations = new Map<string, number>(memberIds.map((id) => [id, 0] as const));
  if (amountCents === 0) return allocations;
  if (weightTotal <= 0 || !Number.isSafeInteger(weightTotal)) throw new Error("Cannot allocate a charge without an item subtotal.");

  let allocated = 0;
  const remainders = memberIds.map((id, index) => {
    const numerator = BigInt(amountCents) * BigInt(weights.get(id) ?? 0);
    const denominator = BigInt(weightTotal);
    const floor = Number(numerator / denominator);
    allocations.set(id, floor);
    allocated += floor;
    return { id, index, remainder: numerator % denominator };
  });
  remainders.sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (let index = 0; index < amountCents - allocated; index += 1) {
    const memberId = remainders[index].id;
    allocations.set(memberId, (allocations.get(memberId) ?? 0) + 1);
  }
  return allocations;
}

function adjustmentDelta(adjustment: ReceiptAdjustment) {
  if (adjustment.includedInSubtotal || !adjustment.includedInTotal) return 0;
  return adjustment.kind === "discount" ? -adjustment.amountCents : adjustment.amountCents;
}

function validateAdjustments(adjustments: ReceiptAdjustment[], flags: string[], notes: string[]) {
  for (const adjustment of adjustments) {
    if (!Number.isSafeInteger(adjustment.amountCents) || adjustment.amountCents < 0 || !adjustment.label.trim()) {
      flags.push("adjustment");
      notes.push(`Adjustment ${adjustment.id} is invalid.`);
    } else if (!adjustment.confirmed) {
      flags.push("adjustment");
      notes.push(`Confirm whether ${adjustment.label} is already included before splitting.`);
    }
  }
}

/** Validates the receipt boundary before it is handed to a group. */
export function validateReceiptForTransfer(
  receipt: Receipt,
  reviewFlags: SplitReceiptInput["reviewFlags"],
  tipConfirmed: boolean,
  reviewAcknowledged = false,
  adjustments: ReceiptAdjustment[] = [],
): ReceiptTransferValidation {
  const flags: string[] = [];
  const notes: string[] = [];
  const currency = isCurrencyCode(receipt.currency) ? receipt.currency : null;
  if (!currency) { flags.push("currency"); notes.push("Receipt currency is missing or unsupported. Confirm it before sending this receipt to a group."); }
  const arithmeticCurrency = currency ?? "USD";
  const subtotalCents = minorUnits(receipt.subtotal, arithmeticCurrency);
  const totalCents = minorUnits(receipt.total, arithmeticCurrency);
  const taxCents = minorUnits(receipt.tax, arithmeticCurrency);
  const tipCents = minorUnits(receipt.tip, arithmeticCurrency);

  if (subtotalCents === null) { flags.push("subtotal"); notes.push("Subtotal is missing or invalid."); }
  if (totalCents === null) { flags.push("total"); notes.push("Receipt total is missing or invalid."); }
  if (taxCents === null) { flags.push("tax"); notes.push("Tax is missing or invalid."); }
  if (tipCents === null) { flags.push("tip"); notes.push("Tip is missing or invalid."); }

  let itemSubtotalCents = 0;
  for (const [index, item] of receipt.items.entries()) {
    const lineTotal = lineTotalCents(item, arithmeticCurrency);
    const storedTotal = minorUnits(item.total, arithmeticCurrency);
    if (!item.name.trim() || lineTotal === null || storedTotal === null || Math.abs(lineTotal - storedTotal) > 1) {
      flags.push(`items[${index}]`);
      notes.push(`Item ${index + 1} needs a valid name, quantity, and price.`);
    } else {
      itemSubtotalCents += lineTotal;
    }
  }
  if (!Number.isSafeInteger(itemSubtotalCents) || subtotalCents !== null && Math.abs(itemSubtotalCents - subtotalCents) > 1) {
    flags.push("subtotal");
    notes.push("The itemized subtotal does not match the extracted item totals.");
  }

  if (!tipConfirmed) { flags.push("tip"); notes.push("Confirm the actual tip before sending this receipt to a group."); }
  if (reviewFlags.needsConfirmation || (reviewFlags.needsReview && !reviewAcknowledged)) {
    flags.push("review");
    notes.push("Review and confirm the highlighted receipt details before continuing.");
  }

  validateAdjustments(adjustments, flags, notes);
  if (totalCents !== null && subtotalCents !== null && taxCents !== null && tipCents !== null && !flags.includes("subtotal") && !flags.includes("adjustment")) {
    const adjustmentTotal = adjustments.reduce((sum, adjustment) => sum + adjustmentDelta(adjustment), 0);
    const expected = subtotalCents + taxCents + tipCents + adjustmentTotal;
    if (expected !== totalCents) {
      flags.push("total");
      notes.push("Subtotal, tax, tip, and confirmed adjustments do not reconcile to the final receipt total.");
    }
  }

  return { valid: flags.length === 0, flags: [...new Set(flags)], notes, receiptSubtotalCents: subtotalCents, receiptTotalCents: totalCents };
}

/** Calculates an exact, itemized split using integer cents and stable largest-remainder rounding. */
export function calculateReceiptSplit(input: SplitReceiptInput): SplitResult {
  const { receipt, memberIds, reviewFlags, tipConfirmed, reviewAcknowledged = false, adjustments = [] } = input;
  const currency = isCurrencyCode(receipt.currency) ? receipt.currency : "USD";
  const orderedMemberIds = [...new Set(memberIds)];
  const validation = validateReceiptForTransfer(receipt, reviewFlags, tipConfirmed, reviewAcknowledged, adjustments);
  const flags = [...validation.flags];
  const notes = [...validation.notes];
  const validMembers = new Set(orderedMemberIds);
  const itemShares = new Map<string, Map<string, number>>();
  const memberItems = new Map(orderedMemberIds.map((id) => [id, [] as MemberBreakdown["items"]]));
  const basis = new Map<string, number>(orderedMemberIds.map((id) => [id, 0] as const));

  for (const item of receipt.items) {
    const assigned = [...new Set(item.assignedMemberIds)];
    if (assigned.length === 0) { flags.push("assignment"); notes.push(`Assign “${item.name || "this item"}” to at least one group member.`); continue; }
    if (assigned.some((id) => !validMembers.has(id)) || assigned.length !== item.assignedMemberIds.length) {
      flags.push("assignment");
      notes.push(`Item “${item.name || "this item"}” has an invalid or duplicate member assignment.`);
      continue;
    }
    const lineTotal = lineTotalCents(item, currency);
    if (lineTotal === null) continue;
    const shares = splitEvenly(lineTotal, assigned);
    itemShares.set(item.id, shares);
    for (const [memberId, amountCents] of shares) {
      basis.set(memberId, (basis.get(memberId) ?? 0) + amountCents);
      memberItems.get(memberId)?.push({ itemId: item.id, name: item.name, amountCents });
    }
  }

  const totalBasis = [...basis.values()].reduce((sum, value) => sum + value, 0);
  const taxCents = minorUnits(receipt.tax, currency) ?? 0;
  const tipCents = minorUnits(receipt.tip, currency) ?? 0;
  let tax = new Map<string, number>();
  let tip = new Map<string, number>();
  if (orderedMemberIds.length > 0 && totalBasis > 0) {
    tax = allocateProportionally(taxCents, basis, orderedMemberIds);
    tip = allocateProportionally(tipCents, basis, orderedMemberIds);
  } else if (receipt.items.length > 0) {
    flags.push("assignment");
    notes.push("Assign every item before calculating shares.");
  }

  const adjustmentTotal = adjustments.reduce((sum, adjustment) => sum + adjustmentDelta(adjustment), 0);
  const adjustmentShares = adjustmentTotal === 0 || totalBasis === 0
    ? new Map<string, number>(orderedMemberIds.map((id) => [id, 0] as const))
    : allocateProportionally(Math.abs(adjustmentTotal), basis, orderedMemberIds);
  const members = orderedMemberIds.map((memberId) => {
    const adjustmentCents = (adjustmentShares.get(memberId) ?? 0) * (adjustmentTotal < 0 ? -1 : 1);
    const itemSubtotalCents = basis.get(memberId) ?? 0;
    const memberTaxCents = tax.get(memberId) ?? 0;
    const memberTipCents = tip.get(memberId) ?? 0;
    return {
      memberId,
      basisCents: itemSubtotalCents,
      proportionBps: totalBasis === 0 ? 0 : Math.round((itemSubtotalCents * 10000) / totalBasis),
      items: memberItems.get(memberId) ?? [],
      itemSubtotalCents,
      taxCents: memberTaxCents,
      tipCents: memberTipCents,
      adjustmentCents,
      finalCents: itemSubtotalCents + memberTaxCents + memberTipCents + adjustmentCents,
    } satisfies MemberBreakdown;
  });
  const allocatedTotalCents = members.reduce((sum, member) => sum + member.finalCents, 0);
  const receiptTotalCents = validation.receiptTotalCents ?? 0;
  const totalsMatch = allocatedTotalCents === receiptTotalCents;
  if (!totalsMatch) { flags.push("total"); notes.push("The calculated member totals do not match the final receipt total."); }
  if (validation.receiptSubtotalCents !== null && totalBasis !== validation.receiptSubtotalCents) {
    flags.push("subtotal");
    notes.push("Assigned item shares do not match the receipt subtotal.");
  }

  return {
    receiptId: receipt.id,
    currency,
    canFinalize: flags.length === 0 && totalsMatch,
    receiptTotalCents,
    allocatedTotalCents,
    totalsMatch,
    reviewFlags: [...new Set(flags)],
    reviewNotes: [...new Set(notes)],
    members,
  };
}

function hash32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return hash >>> 0;
}

/** Creates a stable UUID-shaped ID without relying on a database or browser-only API. */
export function stableReceiptUuid(...parts: string[]) {
  const value = parts.join("\u001f");
  const words = [2166136261, 2246822519, 3266489917, 668265263].map((seed) => hash32(value, seed));
  const hex = words.map((word) => word.toString(16).padStart(8, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
}
