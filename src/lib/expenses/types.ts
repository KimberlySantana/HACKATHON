import type { CurrencyCode } from "@/lib/currency/types";

/** Browser-only expense record. Amounts are integer minor units in this currency. */
export interface ExpenseItemRecord {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  assignedMemberIds: string[];
  /** Persisted item-level cents shares; absent for legacy/local drafts. */
  memberSharesCents?: Record<string, number>;
}

export interface ExpenseRecord {
  id: string;
  groupId: string;
  description: string;
  paidByMemberId: string;
  items: ExpenseItemRecord[];
  taxCents: number;
  tipCents: number;
  /** Original currency of this expense. Legacy local records may omit it and are treated as USD. */
  currency?: CurrencyCode;
  createdAt: string;
}
