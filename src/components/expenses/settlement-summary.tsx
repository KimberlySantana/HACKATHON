"use client";

import Link from "next/link";
import { Copy, Download } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { useGroupExpenses, type ExpenseStorageMode } from "@/components/expenses/use-group-expenses";
import { calculateExpenseShares, calculateSettlement, formatCents, getExpenseSubtotalCents } from "@/lib/expenses/calculations";
import { getUnassignedItems } from "@/lib/expenses/assignments";
import { buildSettlementCopySummary } from "@/lib/expenses/settlement-sharing";
import { PaymentReminderComposer } from "@/components/expenses/payment-reminder-composer";
import type { ExpenseRecord } from "@/lib/expenses/types";

export function SettlementSummary({ groupId }: { groupId: string }) {
  const { groups, loading: groupsLoading, storageError } = useSavedGroups();
  const saved = groups.find((entry) => entry.group.id === groupId);
  const store = useGroupExpenses(groupId, saved?.members ?? []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [reportError, setReportError] = useState<string | null>(null);
  const [busyExpenseId, setBusyExpenseId] = useState<string | null>(null);
  const members = saved?.members ?? [];
  const memberIds = members.map((member) => member.id);
  const expensesNeedingAssignment = useMemo(
    () => store.expenses.filter((expense) => getUnassignedItems(expense.items, memberIds).length > 0),
    [memberIds.join("|"), store.expenses],
  );
  const totals = useMemo(() => {
    if (!saved || expensesNeedingAssignment.length > 0) return null;
    try { return calculateSettlement(store.expenses, saved.members); }
    catch { return null; }
  }, [expensesNeedingAssignment.length, saved, store.expenses]);
  const names = new Map(members.map((member) => [member.id, member.name]));

  async function removeExpense(expense: ExpenseRecord, source: ExpenseStorageMode) {
    if (!window.confirm(`Delete “${expense.description}”? This cannot be undone.`)) return;
    setBusyExpenseId(expense.id);
    setActionError(null);
    setActionNotice(null);
    try { await store.remove(expense.id, source); setActionNotice("Expense deleted. The settlement has been updated."); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not delete this expense."); }
    finally { setBusyExpenseId(null); }
  }

  async function importExpense(expense: ExpenseRecord) {
    setBusyExpenseId(expense.id);
    setActionError(null);
    try { await store.importOffline(expense.id); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Could not import this expense."); }
    finally { setBusyExpenseId(null); }
  }

  async function copySettlementSummary() {
    if (!totals || !saved) return;
    const summary = buildSettlementCopySummary(saved.group.name, totals.transfers, members);
    try {
      await navigator.clipboard.writeText(summary);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  async function downloadSettlementReport() {
    if (!saved || !totals || store.expenses.length === 0) return;
    try {
      const { createSettlementPdf } = await import("@/lib/expenses/pdf-report");
      const bytes = await createSettlementPdf({
        group: { name: saved.group.name, members },
        expenses: store.expenses,
        transfers: totals.transfers,
        balances: totals.balances,
        dataSource: store.signedIn ? "Cloud-saved records" : "Guest records on this device",
      });
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const filename = saved.group.name.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "splitzy-group";
      anchor.href = url;
      anchor.download = `${filename}-settlement.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setReportError(null);
    } catch {
      setReportError("The PDF report couldn’t be created. Your saved expenses were not changed.");
    }
  }

  if (groupsLoading || store.loading) return <p role="status" className="rounded-2xl border border-[#ebe7de] bg-white p-5 text-sm text-[#77766d]">Loading {store.signedIn ? "cloud expenses" : "guest expenses"}…</p>;
  if (!saved) return <section className="rounded-3xl border border-[#ebe7de] bg-white p-6"><h1 className="text-xl font-bold">Group not found</h1><p className="mt-2 text-sm text-[#77766d]">Load the group in this browser or wait for cloud access to return.</p><Link href="/" className="mt-4 inline-flex font-bold text-[#d9674b]">Back home →</Link></section>;

  const activeSource: ExpenseStorageMode = store.signedIn ? "cloud" : "guest";
  const editUrl = (expense: ExpenseRecord, source: ExpenseStorageMode) => {
    const offlineParam = source === "offline" ? "?offline=true" : "";
    return `/groups/${encodeURIComponent(groupId)}/expenses/${encodeURIComponent(expense.id)}/edit${offlineParam}`;
  };

  return <div className="space-y-5">
    <header className="rounded-3xl border border-[#ebe7de] bg-white p-5 sm:p-8">
      <p className="text-xs font-bold tracking-[0.16em] text-[#99968d]">{saved.group.name.toUpperCase()}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.05em]">Settlement</h1>
      <p className="mt-2 text-sm leading-6 text-[#77766d]">{store.signedIn ? "Showing expenses saved in your Supabase account." : "Guest mode: expenses are saved only in this browser and are not synced."}</p>
      <Link href={`/groups/${encodeURIComponent(groupId)}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#77766d] hover:bg-[#f7f6f1] hover:text-[#45634e]"><span aria-hidden="true">←</span>Back to group</Link>
      {(storageError || store.error) && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a64531]">{store.error ?? storageError}</p>}
      {store.error && <button type="button" onClick={() => void store.refresh()} className="mt-3 min-h-11 rounded-lg px-2 text-sm font-bold text-[#d9674b]">Try loading again</button>}
      {actionError && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a64531]">{actionError}</p>}
      {actionNotice && <p role="status" className="mt-3 rounded-xl border border-[#cfe0d3] bg-[#f1f7f2] p-3 text-sm font-medium text-primary">{actionNotice}</p>}
    </header>

    {expensesNeedingAssignment.length > 0 && <section role="alert" className="rounded-3xl border border-[#e8b1a5] bg-[#fff3ef] p-5 sm:p-8"><h2 className="text-lg font-bold text-[#8f3928]">Some expenses need an item assignment</h2><p className="mt-1 text-sm leading-6 text-[#8f3928]">Settlement is paused until every item has at least one person assigned. Edit these expenses to choose who shared each item.</p><ul className="mt-4 space-y-3">{expensesNeedingAssignment.map((expense) => <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/80 p-3 text-sm"><span><strong>{expense.description}</strong><span className="ml-2 text-[#77766d]">{getUnassignedItems(expense.items, memberIds).map((item) => item.name || "Unnamed item").join(", ")}</span></span><Link href={editUrl(expense, activeSource)} className="font-bold text-[#a64531] underline underline-offset-2">Edit expense</Link></li>)}</ul></section>}

    {store.signedIn && store.offlineExpenses.length > 0 && <section className="rounded-3xl border border-[#e9d7aa] bg-[#fffaf0] p-5 sm:p-8"><h2 className="text-lg font-bold">Browser copies not synced</h2><p className="mt-1 text-sm leading-6 text-[#725a2b]">These expenses are kept separate from the cloud settlement. Import each one explicitly; existing cloud rows are never overwritten.</p><div className="mt-4 space-y-3">{store.offlineExpenses.map((expense) => <ExpenseCard key={`offline-${expense.id}`} expense={expense} names={names} members={members.map((member) => member.id)} editUrl={editUrl(expense, "offline")} onDelete={() => void removeExpense(expense, "offline")} deleting={busyExpenseId === expense.id} action={<button type="button" disabled={busyExpenseId === expense.id} onClick={() => void importExpense(expense)} className="min-h-9 rounded-lg bg-[#80622a] px-3 text-xs font-bold text-white disabled:opacity-60">{busyExpenseId === expense.id ? "Importing…" : "Import to cloud"}</button>} />)}</div></section>}

    <section className="rounded-3xl border border-[#ebe7de] bg-white p-5 sm:p-8"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Balances</h2><span className="text-xs text-[#88867d]">{store.signedIn ? "Cloud records only" : "Guest records"}</span></div>{(store.error || storageError) ? <p role="status" className="mt-3 text-sm text-[#77766d]">Balances are unavailable until the saved records can be loaded.</p> : expensesNeedingAssignment.length > 0 ? <p className="mt-3 text-sm text-[#77766d]">Balances will appear after every expense item has a person assigned.</p> : !store.expenses.length ? <p className="mt-3 text-sm text-[#77766d]">No expenses in this view yet. Add one to see each person’s share.</p> : totals ? <div className="mt-4 divide-y divide-[#eeeae2]">{members.map((member) => { const balance = totals.balances.get(member.id) ?? 0; return <div key={member.id} className="flex items-center justify-between gap-4 py-3"><span className="font-semibold">{member.name}</span><span className={`text-sm font-bold ${balance > 0 ? "text-[#567342]" : balance < 0 ? "text-[#a64531]" : "text-[#77766d]"}`}>{balance > 0 ? `Gets back ${formatCents(balance)}` : balance < 0 ? `Owes ${formatCents(-balance)}` : "No balance due"}</span></div>; })}</div> : <p role="alert" className="mt-3 text-sm text-[#a64531]">Settlement could not be calculated. Edit the expense items and check their assignments.</p>}</section>

    {store.expenses.length > 0 && expensesNeedingAssignment.length === 0 && totals && <section className="rounded-3xl border border-[#ebe7de] bg-white p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Suggested transfers</h2><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void downloadSettlementReport()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-white px-4 text-sm font-bold text-primary hover:bg-[#f3f7f3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><Download size={15} aria-hidden="true" /><span>Download PDF</span></button></div></div>{reportError && <p role="alert" className="mt-3 rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a64531]">{reportError}</p>}{totals.transfers.length ? <div className="mt-4 space-y-3">{totals.transfers.map((transfer, index) => <div key={`${transfer.fromMemberId}-${transfer.toMemberId}-${index}`} className="rounded-2xl bg-[#f7f6f1] p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{names.get(transfer.fromMemberId)} pays {names.get(transfer.toMemberId)}</span><strong>{formatCents(transfer.amountCents)}</strong></div><PaymentReminderComposer groupName={saved.group.name} transfer={transfer} fromName={names.get(transfer.fromMemberId) ?? "Group member"} toName={names.get(transfer.toMemberId) ?? "Group member"} /></div>)}</div> : <p className="mt-3 text-sm text-[#77766d]">No transfers are due from these expenses.</p>}<div className="mt-5 border-t border-[#eeeae2] pt-4"><button type="button" onClick={() => void copySettlementSummary()} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-[#f3f7f3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><Copy size={15} aria-hidden="true" />Copy Summary</button></div>{copyState === "copied" && <p role="status" className="mt-3 text-sm font-medium text-primary">Summary copied.</p>}{copyState === "failed" && <div className="mt-3"><p role="status" className="text-sm text-[#77766d]">Couldn’t access the clipboard. Select and copy this summary:</p><pre className="mt-2 select-all whitespace-pre-wrap rounded-xl bg-[#f7f6f1] p-3 text-sm">{buildSettlementCopySummary(saved.group.name, totals.transfers, members)}</pre></div>}</section>}

    <section className="rounded-3xl border border-[#ebe7de] bg-white p-5 sm:p-8"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Expenses</h2><span className="text-xs text-[#88867d]">{store.expenses.length} {activeSource === "cloud" ? "saved to cloud" : "saved in this browser"}</span></div>{(store.error || storageError) ? <p className="mt-3 text-sm text-[#77766d]">Saved expenses aren’t shown as empty while storage is unavailable.</p> : !store.expenses.length ? <p className="mt-3 text-sm text-[#77766d]">No expenses have been recorded for this group yet.</p> : <div className="mt-4 space-y-3">{store.expenses.map((expense) => <ExpenseCard key={expense.id} expense={expense} names={names} members={members.map((member) => member.id)} editUrl={editUrl(expense, activeSource)} deleting={busyExpenseId === expense.id} onDelete={() => void removeExpense(expense, activeSource)} />)}</div>}</section>

    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Link href={`/groups/${encodeURIComponent(groupId)}`} className="inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-[#77766d]">Group details</Link><Link href={`/groups/${encodeURIComponent(groupId)}/expenses/new`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#ed795d] px-6 text-sm font-bold text-white">+ Add expense</Link></div>
  </div>;
}

function ExpenseCard({ expense, names, members, editUrl, onDelete, deleting, action }: { expense: ExpenseRecord; names: Map<string, string>; members: string[]; editUrl: string; onDelete: () => void; deleting: boolean; action?: ReactNode }) {
  const unassignedItems = getUnassignedItems(expense.items, members);
  const shares = unassignedItems.length === 0 ? calculateExpenseShares(expense, members) : null;
  const total = getExpenseSubtotalCents(expense) + expense.taxCents + expense.tipCents;
  return <details className={`rounded-2xl border p-4 ${unassignedItems.length ? "border-[#e8b1a5] bg-[#fffaf8]" : "border-[#eeeae2]"}`}>
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span className="min-w-0"><strong className="block truncate">{expense.description}</strong><span className="mt-1 block text-xs text-[#88867d]">Paid by {names.get(expense.paidByMemberId)} · {expense.items.length} {expense.items.length === 1 ? "item" : "items"}</span></span><strong className="shrink-0">{formatCents(total)}</strong></summary>
    <div className="mt-4 space-y-2 border-t border-[#eeeae2] pt-3 text-sm">
      {unassignedItems.length > 0 && <p className="rounded-xl bg-[#fff1ee] p-3 text-sm text-[#a64531]">This expense has items without a person assigned. <Link href={editUrl} className="font-bold underline underline-offset-2">Edit it to fix the split.</Link></p>}
      {expense.items.map((item) => <div key={item.id} className="flex justify-between gap-3"><span className="min-w-0"><span>{item.quantity} × {item.name}</span><span className="ml-2 text-xs text-[#88867d]">{item.assignedMemberIds.map((id) => names.get(id)).filter(Boolean).join(", ") || (unassignedItems.includes(item) ? "Needs a person assigned" : "")}</span>{item.note?.trim() && <span className="mt-1 block whitespace-pre-wrap text-xs leading-5 text-[#77766d]">Note: {item.note}</span>}</span><span className="shrink-0">{formatCents(item.quantity * item.unitPriceCents)}</span></div>)}
      <div className="flex justify-between text-[#77766d]"><span>Tax</span><span>{formatCents(expense.taxCents)}</span></div><div className="flex justify-between text-[#77766d]"><span>Tip</span><span>{formatCents(expense.tipCents)}</span></div>
      {shares && <div className="border-t border-dashed border-[#dedbd1] pt-2 font-semibold">{members.map((memberId) => <div key={memberId} className="flex justify-between py-1"><span>{names.get(memberId)} share</span><span>{formatCents(shares.get(memberId) ?? 0)}</span></div>)}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2"><Link href={editUrl} className="inline-flex min-h-9 items-center rounded-lg border border-[#e7e2d8] px-3 text-xs font-bold text-[#625f56]">Edit</Link><button type="button" disabled={deleting} onClick={onDelete} className="min-h-9 rounded-lg border border-[#f0d1c9] px-3 text-xs font-bold text-[#a64531] disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>{action}</div>
    </div>
  </details>;
}
