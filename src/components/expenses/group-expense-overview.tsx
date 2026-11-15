"use client";

import Link from "next/link";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { useGroupExpenses } from "@/components/expenses/use-group-expenses";
import { getExpenseSubtotalCents } from "@/lib/expenses/calculations";
import { CurrencyAmount } from "@/components/currency";

export function GroupExpenseOverview({ groupId }: { groupId: string }) {
  const { groups } = useSavedGroups();
  const group = groups.find((entry) => entry.group.id === groupId);
  const store = useGroupExpenses(groupId, group?.members ?? []);
  if (store.loading) return <p role="status" className="brand-card mb-5 p-4 text-sm text-muted">Loading saved expenses…</p>;
  return <section className="brand-card mb-5 p-4 sm:p-5">
    <div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold">Expenses</h2><p className="mt-1 text-xs text-muted">{store.signedIn ? "Cloud-synced records" : "Guest records saved on this device"}</p></div><Link href={`/groups/${encodeURIComponent(groupId)}/settlement`} className="shrink-0 text-sm font-extrabold text-[#a45c4b] hover:underline">View settlement →</Link></div>
    {store.error && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a64531]">{store.error}</p>}
    {!store.error && store.expenses.length === 0 && <p className="mt-3 text-sm text-[#88867d]">No expenses saved for this group yet.</p>}
    {store.expenses.length > 0 && <ul className="mt-3 divide-y divide-[#eeeae2]">{store.expenses.slice(0, 3).map((expense) => <li key={expense.id} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{expense.description}</span><CurrencyAmount amountMinor={getExpenseSubtotalCents(expense) + expense.taxCents + expense.tipCents} originalCurrency={expense.currency ?? "USD"} className="shrink-0 font-semibold text-right" /></li>)}</ul>}
    {store.signedIn && store.offlineExpenses.length > 0 && <p className="mt-3 rounded-lg bg-[#fff7e6] px-3 py-2 text-xs text-[#725a2b]">{store.offlineExpenses.length} browser expense{store.offlineExpenses.length === 1 ? "" : "s"} not synced. Review and import from Settlement.</p>}
  </section>;
}
