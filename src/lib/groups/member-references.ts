import type { ExpenseRecord } from "@/lib/expenses/types";

/** Returns members that cannot be removed while saved expenses still reference them. */
export function findReferencedMembers(memberIds: string[], expenses: ExpenseRecord[]): string[] {
  const candidateIds = new Set(memberIds);
  const referenced = new Set<string>();

  for (const expense of expenses) {
    if (candidateIds.has(expense.paidByMemberId)) referenced.add(expense.paidByMemberId);
    for (const item of expense.items) {
      for (const memberId of item.assignedMemberIds) {
        if (candidateIds.has(memberId)) referenced.add(memberId);
      }
    }
  }

  return memberIds.filter((memberId) => referenced.has(memberId));
}
