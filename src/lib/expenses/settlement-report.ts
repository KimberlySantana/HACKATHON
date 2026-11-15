import type { CurrencyCode } from "../currency/types.ts";
import { calculateExpenseShares, calculateSettlement, expenseChargeCents, getExpenseSubtotalCents, type Transfer } from "./calculations.ts";
import type { ExpenseRecord } from "./types.ts";

export interface SettlementReportItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface SettlementReportExpense {
  id: string;
  description: string;
  paidBy: string;
  items: SettlementReportItem[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
}

export interface SettlementReportMember {
  id: string;
  name: string;
  shareCents: number;
  balanceCents: number;
}

export interface SettlementReportTransfer {
  from: string;
  to: string;
  amountCents: number;
}

export interface SettlementReport {
  groupName: string;
  generatedAt: string;
  currency: CurrencyCode;
  totalExpensesCents: number;
  totalTaxCents: number;
  totalTipCents: number;
  expenses: SettlementReportExpense[];
  members: SettlementReportMember[];
  transfers: SettlementReportTransfer[];
}

type SettlementTotals = ReturnType<typeof calculateSettlement>;

function transferNames(transfer: Transfer, names: Map<string, string>): SettlementReportTransfer {
  return {
    from: names.get(transfer.fromMemberId) ?? transfer.fromMemberId,
    to: names.get(transfer.toMemberId) ?? transfer.toMemberId,
    amountCents: transfer.amountCents,
  };
}

/** Creates a display/report model from the same exact settlement calculations used by the page. */
export function buildSettlementReport(
  groupName: string,
  expenses: ExpenseRecord[],
  members: Array<{ id: string; name: string }>,
  totals: SettlementTotals,
  generatedAt = new Date(),
): SettlementReport {
  const currency = expenses[0]?.currency ?? "USD";
  const names = new Map(members.map((member) => [member.id, member.name]));
  const memberShares = new Map(members.map((member) => [member.id, 0]));
  let totalExpensesCents = 0;
  let totalTaxCents = 0;
  let totalTipCents = 0;

  const reportExpenses = expenses.map((expense) => {
    const subtotalCents = getExpenseSubtotalCents(expense);
    const charges = expenseChargeCents(expense);
    const totalCents = subtotalCents + charges.taxCents + charges.tipCents;
    const shares = calculateExpenseShares(expense, members.map((member) => member.id));
    for (const [memberId, shareCents] of shares) {
      memberShares.set(memberId, (memberShares.get(memberId) ?? 0) + shareCents);
    }
    totalExpensesCents += totalCents;
    totalTaxCents += charges.taxCents;
    totalTipCents += charges.tipCents;

    return {
      id: expense.id,
      description: expense.description,
      paidBy: names.get(expense.paidByMemberId) ?? expense.paidByMemberId,
      items: expense.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        totalCents: item.quantity * item.unitPriceCents,
      })),
      subtotalCents,
      taxCents: charges.taxCents,
      tipCents: charges.tipCents,
      totalCents,
    };
  });

  if (totalExpensesCents !== [...memberShares.values()].reduce((sum, share) => sum + share, 0)) {
    throw new Error("Settlement report totals do not reconcile.");
  }

  return {
    groupName,
    generatedAt: generatedAt.toISOString(),
    currency,
    totalExpensesCents,
    totalTaxCents,
    totalTipCents,
    expenses: reportExpenses,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      shareCents: memberShares.get(member.id) ?? 0,
      balanceCents: totals.balances.get(member.id) ?? 0,
    })),
    transfers: totals.transfers.map((transfer) => transferNames(transfer, names)),
  };
}
