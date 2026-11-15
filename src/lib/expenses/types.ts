import type { CurrencyCode } from "../currency/types.ts";

/** Browser-only expense record. Amounts are integer minor units in the receipt currency. */
export interface ExpenseItemRecord {
  id: string;
  name: string;
  /** Optional user-authored context for this item; does not affect calculations. */
  note?: string;
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
  /** Legacy expenses without this field are USD. */
  currency?: CurrencyCode;
  createdAt: string;
}
