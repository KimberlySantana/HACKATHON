"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { useGroupExpenses, type ExpenseStorageMode } from "@/components/expenses/use-group-expenses";
import { expenseCurrency, getExpenseSubtotalCents } from "@/lib/expenses/calculations";
import { CurrencyAmount } from "@/components/currency";
import type { ExpenseRecord } from "@/lib/expenses/types";
import { FormErrorToast } from "@/components/ui/form-error-toast";
import { Button } from "@/components/ui/button";

export function GroupExpenseOverview({ groupId }: { groupId: string }) {
  const { groups } = useSavedGroups();
  const group = groups.find((entry) => entry.group.id === groupId);
  const store = useGroupExpenses(groupId, group?.members ?? []);
  const [pendingDelete, setPendingDelete] = useState<ExpenseRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pendingDelete && !dialog.open) dialog.showModal();
    if (!pendingDelete && dialog.open) dialog.close();
  }, [pendingDelete]);

  function requestDelete(expense: ExpenseRecord, event: MouseEvent<HTMLButtonElement>) {
    const menu = event.currentTarget.closest("details");
    if (menu instanceof HTMLDetailsElement) menu.open = false;
    setDeleteError(null);
    setPendingDelete(expense);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    setNotice(null);
    const source: ExpenseStorageMode = store.signedIn ? "cloud" : "guest";
    try {
      await store.remove(pendingDelete.id, source);
      setPendingDelete(null);
      setNotice(`“${pendingDelete.description}” was deleted. Settlement will use the updated saved expenses.`);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Receipt could not be deleted. Your saved data was preserved.");
    } finally {
      setDeleting(false);
    }
  }

  if (store.loading) return <p role="status" className="mb-5 rounded-2xl border border-[#ebe7de] bg-white p-4 text-sm text-[#77766d]">Loading saved expenses…</p>;

  return <>
    <section className="mb-5 rounded-2xl border border-[#ebe7de] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Expenses</h2><p className="mt-1 text-xs text-[#77766d]">{store.signedIn ? "Cloud-synced records" : "Guest records saved on this device"}</p></div><Link href={`/groups/${encodeURIComponent(groupId)}/settlement`} className="shrink-0 text-sm font-bold text-[#d9674b]">View settlement →</Link></div>
      {store.error && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a64531]">{store.error}</p>}
      {!store.error && store.expenses.length === 0 && <p className="mt-3 text-sm text-[#88867d]">No expenses saved for this group yet.</p>}
      {store.expenses.length > 0 && <ul className="mt-3 space-y-2.5">
        {store.expenses.map((expense) => <li key={expense.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eeeae2] bg-[#fcfdfb] p-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{expense.description}</p><p className="mt-1 text-xs text-[#77766d]">{expense.items.length} {expense.items.length === 1 ? "item" : "items"}</p></div>
          <div className="flex shrink-0 items-center gap-2"><strong className="text-sm"><CurrencyAmount amountMinor={getExpenseSubtotalCents(expense) + expense.taxCents + expense.tipCents} originalCurrency={expenseCurrency(expense)} /></strong>
            <details className="relative">
              <summary aria-label={`More actions for ${expense.description}`} title="More actions" className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg text-[#77766d] hover:bg-[#f0f2ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><MoreHorizontal size={20} aria-hidden="true" /></summary>
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-[#e7e2d8] bg-white p-1.5 shadow-lg">
                <Link href={`/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expense.id)}/edit`} onClick={(event) => { const menu = event.currentTarget.closest("details"); if (menu instanceof HTMLDetailsElement) menu.open = false; }} className="flex min-h-11 w-full items-center rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-[#f0f2ed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">Edit Receipt</Link>
                <button type="button" onClick={(event) => requestDelete(expense, event)} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-[#a64531] hover:bg-[#fff1ee] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a64531]/15">Delete Receipt</button>
              </div>
            </details>
          </div>
        </li>)}
      </ul>}
      {store.signedIn && store.offlineExpenses.length > 0 && <p className="mt-3 rounded-lg bg-[#fff7e6] px-3 py-2 text-xs text-[#725a2b]">{store.offlineExpenses.length} browser expense{store.offlineExpenses.length === 1 ? "" : "s"} not synced. Review and import from Settlement.</p>}
      {notice && <p role="status" className="mt-3 rounded-xl border border-[#cfe0d3] bg-[#f1f7f2] p-3 text-sm font-medium text-primary">{notice}</p>}
    </section>

    <dialog ref={dialogRef} aria-labelledby="delete-receipt-title" aria-describedby="delete-receipt-description" onCancel={(event) => { event.preventDefault(); if (!deleting) { setPendingDelete(null); setDeleteError(null); } }} onClick={(event) => { if (event.target === event.currentTarget && !deleting) { setPendingDelete(null); setDeleteError(null); } }} className="m-auto max-h-[min(90dvh,38rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-border bg-white p-0 text-foreground shadow-2xl backdrop:bg-[#18251f]/45">
      {pendingDelete && <div className="p-5 sm:p-6">
        <h2 id="delete-receipt-title" className="text-lg font-semibold">Delete this receipt?</h2>
        <p id="delete-receipt-description" className="mt-2 text-sm leading-6 text-muted">“{pendingDelete.description}” and its item splits will be permanently removed from {store.signedIn ? "Supabase" : "this browser"}. Settlement will recalculate from the remaining saved expenses.</p>
        {deleteError && <FormErrorToast message={deleteError} />}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={deleting} onClick={() => { setPendingDelete(null); setDeleteError(null); }}>Cancel</Button>
          <Button type="button" variant="danger" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? "Deleting receipt…" : "Delete Receipt"}</Button>
        </div>
      </div>}
    </dialog>
  </>;
}
