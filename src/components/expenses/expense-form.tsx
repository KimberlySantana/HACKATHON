"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CircleDollarSign, Plus, Trash2 } from "lucide-react";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { useGroupExpenses, type ExpenseStorageMode } from "@/components/expenses/use-group-expenses";
import { calculateExpenseShares, formatCents, getExpenseSubtotalCents, parseMoneyToMinorUnits } from "@/lib/expenses/calculations";
import { assignEveryone, getUnassignedItems, toggleAssignedMember } from "@/lib/expenses/assignments";
import { hasExplicitPayer } from "@/lib/expenses/validation";
import { expenseReturnHref, removeDraftItem } from "@/lib/expenses/draft";
import { canLeaveWithUnsavedChanges } from "@/lib/forms/navigation";
import { isReceiptExpenseDraft, receiptDraftStorageKey } from "@/lib/receipt/draft";
import type { ExpenseRecord } from "@/lib/expenses/types";
import { CURRENCY_CODES, CURRENCY_DECIMALS, CURRENCY_LABELS, type CurrencyCode } from "@/lib/currency/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormErrorToast } from "@/components/ui/form-error-toast";

interface DraftItem { id: string; name: string; note: string; noteOpen: boolean; quantity: string; unitPrice: string; assignedMemberIds: string[]; memberSharesCents?: Record<string, number>; }
const blankItem = (): DraftItem => ({ id: "new-item-1", name: "", note: "", noteOpen: false, quantity: "1", unitPrice: "", assignedMemberIds: [] });
const moneyValue = (value: string, currency: CurrencyCode) => value.trim() === "" ? 0 : parseMoneyToMinorUnits(value, currency);
const centsInput = (amount: number, currency: CurrencyCode) => {
  const decimals = CURRENCY_DECIMALS[currency];
  const factor = 10 ** decimals;
  return decimals ? `${Math.floor(amount / factor)}.${String(amount % factor).padStart(decimals, "0")}` : String(amount);
};

export function ExpenseForm({ groupId, expenseId, offline = false, fromScan = false }: { groupId: string; expenseId?: string; offline?: boolean; fromScan?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { groups, loading, storageError } = useSavedGroups();
  const saved = groups.find((entry) => entry.group.id === groupId);
  const expenseStore = useGroupExpenses(groupId, saved?.members ?? []);
  const [description, setDescription] = useState("");
  const [paidByMemberId, setPaidByMemberId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [tax, setTax] = useState("");
  const [tip, setTip] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingOfflineExpense, setPendingOfflineExpense] = useState<ExpenseRecord | null>(null);
  const [editReady, setEditReady] = useState(!expenseId && !fromScan);
  const [editMissing, setEditMissing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [scannedReceiptCreatedAt, setScannedReceiptCreatedAt] = useState<string | null>(null);
  const [receiptDraftError, setReceiptDraftError] = useState<string | null>(null);

  const editRecord = expenseId
    ? offline || !expenseStore.signedIn
      ? expenseStore.signedIn ? expenseStore.offlineExpenses.find((entry) => entry.id === expenseId) : expenseStore.expenses.find((entry) => entry.id === expenseId)
      : expenseStore.expenses.find((entry) => entry.id === expenseId)
    : undefined;

  useEffect(() => {
    if (!expenseId || loading || expenseStore.loading) return;
    if (!editRecord) { setEditMissing(true); setEditReady(true); return; }
    setDescription(editRecord.description);
    setCurrency(editRecord.currency ?? "USD");
    setPaidByMemberId(editRecord.paidByMemberId);
    setTax(centsInput(editRecord.taxCents, editRecord.currency ?? "USD"));
    setTip(centsInput(editRecord.tipCents, editRecord.currency ?? "USD"));
    setItems(editRecord.items.map((item) => ({
      id: item.id,
      name: item.name,
      note: item.note ?? "",
      noteOpen: Boolean(item.note),
      quantity: String(item.quantity),
      unitPrice: centsInput(item.unitPriceCents, editRecord.currency ?? "USD"),
      assignedMemberIds: item.assignedMemberIds,
      memberSharesCents: item.memberSharesCents,
    })));
    setDirty(false);
    setEditReady(true);
  }, [editRecord, expenseId, expenseStore.loading, loading]);

  useEffect(() => {
    if (!fromScan || expenseId || loading || expenseStore.loading) return;
    const draftKey = receiptDraftStorageKey(groupId);
    try {
      const serialized = window.sessionStorage.getItem(draftKey);
      const scanned = serialized ? JSON.parse(serialized) as unknown : null;
      if (!scanned || !isReceiptExpenseDraft(scanned, groupId)) {
        setReceiptDraftError("The reviewed receipt draft is missing or invalid. Return to Scan Receipt and review it again, or enter this expense manually.");
        setEditReady(true);
        return;
      }
      setDescription(scanned.description);
      setPaidByMemberId("");
      const scannedCurrency = scanned.currency ?? "USD";
      setCurrency(scannedCurrency);
      setTax(centsInput(scanned.taxCents, scannedCurrency));
      setTip(centsInput(scanned.tipCents, scannedCurrency));
      setItems(scanned.items.map((item) => ({
        id: item.id,
        name: item.name,
        note: "",
        noteOpen: false,
        quantity: String(item.quantity),
        unitPrice: centsInput(item.unitPriceCents, scannedCurrency),
        assignedMemberIds: [],
      })));
      setScannedReceiptCreatedAt(scanned.createdAt);
      setReceiptDraftError(null);
      setDirty(false);
      setEditReady(true);
    } catch {
      setReceiptDraftError("The reviewed receipt draft could not be loaded. Return to Scan Receipt and review it again, or enter this expense manually.");
      setEditReady(true);
    }
  }, [expenseId, expenseStore.loading, fromScan, groupId, loading]);

  const parsedItems = useMemo(() => items.map((item) => ({
    draft: item,
    price: parseMoneyToMinorUnits(item.unitPrice, currency),
    quantity: Number(item.quantity),
  })), [currency, items]);
  const subtotalCents = parsedItems.reduce((sum, item) => sum + (item.price ?? 0) * (Number.isInteger(item.quantity) ? item.quantity : 0), 0);
  const taxCents = moneyValue(tax, currency);
  const tipCents = moneyValue(tip, currency);
  const memberIds = saved?.members.map((member) => member.id) ?? [];
  const unassignedItems = getUnassignedItems(items, memberIds);
  const unassignedItemIds = new Set(unassignedItems.map((item) => item.id));
  const currencyLocked = Boolean(expenseId || tax.trim() || tip.trim() || items.some((item) => item.name.trim() || item.unitPrice.trim()));
  const preview = useMemo(() => {
    if (!saved || !description.trim() || !hasExplicitPayer(paidByMemberId, saved.members.map((member) => member.id)) || parsedItems.some(({ draft, price, quantity }) => !draft.name.trim() || price === null || price < 0 || !Number.isInteger(quantity) || quantity < 1 || draft.assignedMemberIds.length === 0) || taxCents === null || tipCents === null) return null;
    const draft: ExpenseRecord = { id: "preview", groupId, description, paidByMemberId, items: parsedItems.map(({ draft: item, price, quantity }) => ({ id: item.id, name: item.name.trim(), note: item.note.trim() || undefined, quantity, unitPriceCents: price!, assignedMemberIds: item.assignedMemberIds, memberSharesCents: item.memberSharesCents })), taxCents, tipCents, currency, createdAt: "" };
    try { return calculateExpenseShares(draft, saved.members.map((member) => member.id)); } catch { return null; }
  }, [currency, description, groupId, paidByMemberId, parsedItems, saved, taxCents, tipCents]);

  function updateItem(itemId: string, update: Partial<DraftItem>) {
    setDirty(true);
    setError(null);
    setInvalidField(null);
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
      const updated = { ...item, ...update };
      if (["name", "quantity", "unitPrice", "assignedMemberIds"].some((key) => key in update)) delete updated.memberSharesCents;
      return updated;
    }));
  }

  function toggleMember(item: DraftItem, memberId: string) {
    updateItem(item.id, { assignedMemberIds: toggleAssignedMember(item.assignedMemberIds, memberId) });
  }

  function assignItemToEveryone(item: DraftItem) {
    updateItem(item.id, { assignedMemberIds: assignEveryone(memberIds) });
  }

  function reject(message: string, fieldId?: string) {
    setError(message);
    setInvalidField(fieldId ?? null);
    if (fieldId) {
      const field = document.getElementById(fieldId);
      field?.focus();
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function leaveEditor() {
    if (!canLeaveWithUnsavedChanges(dirty, () => window.confirm("Discard your unsaved expense changes?"))) return;
    if (fromScan) window.sessionStorage.removeItem(receiptDraftStorageKey(groupId));
    router.push(expenseReturnHref(groupId, Boolean(expenseId)));
  }

  function scrollToFirstUnassignedItem() {
    const firstItem = unassignedItems[0];
    if (!firstItem) return false;
    const assignmentFieldset = document.getElementById(`item-assignees-${firstItem.id}`);
    assignmentFieldset?.scrollIntoView({ behavior: "smooth", block: "center" });
    assignmentFieldset?.querySelector<HTMLButtonElement>('button[type="button"]')?.focus({ preventScroll: true });
    return true;
  }

  function continueToSettlement() {
    const firstUnassigned = unassignedItems[0];
    if (firstUnassigned) {
      reject(`Select at least one person to split item “${firstUnassigned.name || "Unnamed item"}”.`, `item-assignees-${firstUnassigned.id}`);
      scrollToFirstUnassignedItem();
      return;
    }
    formRef.current?.requestSubmit();
  }

  async function persist(expense: ExpenseRecord, target: ExpenseStorageMode) {
    setSaving(true);
    setError(null);
    try {
      await expenseStore.save(expense, target);
      if (fromScan) window.sessionStorage.removeItem(receiptDraftStorageKey(groupId));
      router.push(`/groups/${encodeURIComponent(groupId)}/settlement`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Expense could not be saved.");
      if (target === "cloud") setPendingOfflineExpense(expense);
    } finally { setSaving(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved) return;
    setError(null);
    setInvalidField(null);
    if (!description.trim()) return reject("Enter a merchant or expense name.", "expense-description");
    if (!hasExplicitPayer(paidByMemberId, memberIds)) return reject("Choose who paid for this expense.", "paid-by");
    if (saved.members.length === 0) return reject("Add at least one person to this group before creating an expense.", "manage-group-members");
    if (items.length === 0) return reject("Add at least one item before saving.", "add-expense-item");
    const normalized = parsedItems.map(({ draft, price, quantity }) => ({ draft, price, quantity }));
    for (const { draft, price, quantity } of normalized) {
      const itemNumber = items.findIndex((item) => item.id === draft.id) + 1;
      if (!draft.name.trim()) return reject(`Enter a name for item ${itemNumber}.`, `item-name-${draft.id}`);
      if (price === null || price < 0) return reject(`Enter a valid price for item ${itemNumber}.`, `price-${draft.id}`);
      if (!Number.isInteger(quantity) || quantity < 1) return reject(`Enter a whole-number quantity for item ${itemNumber}.`, `qty-${draft.id}`);
    }
    const unassigned = getUnassignedItems(normalized.map(({ draft }) => draft), memberIds)[0];
    if (unassigned) {
      reject(`Select at least one person to split item “${unassigned.name || "Unnamed item"}”.`, `item-assignees-${unassigned.id}`);
      scrollToFirstUnassignedItem();
      return;
    }
    if (taxCents === null) return reject(`Enter tax as a ${currency} amount with the correct decimal precision.`, "expense-tax");
    if (tipCents === null) return reject(`Enter tip as a ${currency} amount with the correct decimal precision.`, "expense-tip");
    if (taxCents + tipCents > 0 && subtotalCents === 0) return reject("Add an item with a price before adding tax or tip.", items[0] ? `price-${items[0].id}` : "add-expense-item");
    if (!Number.isSafeInteger(subtotalCents + taxCents + tipCents)) return reject("This expense total is too large to calculate safely.");
    if (normalized.some(({ price, quantity }) => !Number.isSafeInteger(price! * quantity))) return reject("An item total is too large to calculate safely.");

    const expense: ExpenseRecord = {
      id: expenseId ?? crypto.randomUUID(), groupId, description: description.trim(), paidByMemberId,
      items: normalized.map(({ draft, price, quantity }) => ({ id: draft.id.startsWith("new-item") ? crypto.randomUUID() : draft.id, name: draft.name.trim(), note: draft.note.trim() || undefined, quantity, unitPriceCents: price!, assignedMemberIds: draft.assignedMemberIds, memberSharesCents: draft.memberSharesCents })),
      taxCents, tipCents, currency, createdAt: editRecord?.createdAt ?? scannedReceiptCreatedAt ?? new Date().toISOString(),
    };
    const target: ExpenseStorageMode = expenseStore.signedIn ? (offline ? "offline" : "cloud") : "guest";
    await persist(expense, target);
  }

  if (loading || expenseStore.loading || !editReady) return <p role="status" className="rounded-2xl border border-[#ebe7de] bg-white p-5 text-sm text-[#77766d]">Loading {expenseId ? "expense" : "group"}…</p>;
  if (!saved) return <section className="rounded-3xl border border-[#ebe7de] bg-white p-6"><h1 className="text-xl font-bold">Group not found</h1><p className="mt-2 text-sm text-[#77766d]">Load the group in this browser or wait for cloud access to return.</p><Link className="mt-4 inline-flex font-bold text-[#d9674b]" href="/">Back home →</Link></section>;
  if (editMissing) return <section className="rounded-3xl border border-[#ebe7de] bg-white p-6"><h1 className="text-xl font-bold">Expense not found</h1><p role={expenseStore.error ? "alert" : "status"} className="mt-2 text-sm text-[#77766d]">{expenseStore.error ?? "It may have been deleted or belongs to a different storage mode."}</p><Link className="mt-4 inline-flex font-bold text-[#d9674b]" href={`/groups/${encodeURIComponent(groupId)}/settlement`}>Back to settlement →</Link></section>;

  return <form ref={formRef} noValidate onSubmit={submit} className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
    <div className="space-y-5">
      <button type="button" onClick={leaveEditor} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted hover:bg-surface-muted hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"><ArrowLeft size={16} aria-hidden="true" />{expenseId ? "Back to settlement" : "Back to group"}</button>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1ed] pb-5">
          <div><Badge tone="green">{saved.group.name}</Badge><h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">{expenseId ? "Review expense" : "Add an expense"}</h2><p className="mt-1 max-w-xl text-sm leading-5 text-muted">Enter the receipt details. You’ll review each person’s share before you save.</p></div>
          {fromScan && !receiptDraftError && <Badge tone="green">Receipt reviewed</Badge>}
        </div>

        {receiptDraftError && <p role="alert" className="mt-4 rounded-xl border border-[#f0d3cd] bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger">{receiptDraftError}</p>}

        {!expenseStore.signedIn && <p role="status" className="mt-4 rounded-xl border border-[#eadbb7] bg-warning-soft px-3.5 py-3 text-sm leading-5 text-[#75511e]">Guest mode · this expense stays in this browser and won’t sync to another device.</p>}
        {expenseStore.signedIn && offline && <p role="status" className="mt-4 rounded-xl border border-[#eadbb7] bg-warning-soft px-3.5 py-3 text-sm leading-5 text-[#75511e]">Offline copy · changes stay in this browser until you choose to import them.</p>}
        {saved.members.length === 0 && <p role="status" className="mt-4 rounded-xl border border-[#eadbb7] bg-warning-soft px-3.5 py-3 text-sm leading-5 text-[#75511e]">Add a group member before creating an expense. <Link id="manage-group-members" href={`/groups/${encodeURIComponent(groupId)}`} className="font-semibold underline underline-offset-2">Manage group members</Link></p>}
        {(storageError || expenseStore.error) && <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#f0d3cd] bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger"><AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{expenseStore.error ?? storageError}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="expense-description" className="mb-1.5 block text-sm font-semibold">Merchant or expense name</label><Input id="expense-description" maxLength={80} value={description} onChange={(event) => { setDescription(event.target.value); setDirty(true); setError(null); setInvalidField(null); }} placeholder="e.g. Dinner at Sunroom" autoComplete="off" aria-invalid={invalidField === "expense-description"} className={invalidField === "expense-description" ? "border-danger ring-2 ring-danger/15" : ""} /></div>
          <div><label htmlFor="paid-by" className="mb-1.5 block text-sm font-semibold">Paid by</label><select id="paid-by" value={paidByMemberId} onChange={(event) => { setPaidByMemberId(event.target.value); setDirty(true); setError(null); setInvalidField(null); }} aria-invalid={invalidField === "paid-by"} className={`h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base shadow-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm ${invalidField === "paid-by" ? "border-danger ring-2 ring-danger/15" : ""}`}><option value="">Choose a payer</option>{saved.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
          <div><label htmlFor="expense-currency" className="mb-1.5 block text-sm font-semibold">Original currency</label><select id="expense-currency" value={currency} disabled={currencyLocked} onChange={(event) => { setCurrency(event.target.value as CurrencyCode); setDirty(true); setError(null); setInvalidField(null); }} className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-sm shadow-sm disabled:bg-surface-muted">{CURRENCY_CODES.map((code) => <option key={code} value={code}>{CURRENCY_LABELS[code]}</option>)}</select><p className="mt-1 text-[11px] leading-4 text-muted">{currencyLocked ? "Currency is fixed after item amounts are entered." : "Choose the receipt currency before adding prices."}</p></div>
          <div className="flex items-end"><p className="text-xs leading-5 text-muted">The payer covers the full receipt upfront. The split below shows how the group shares it.</p></div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#edf1ed] px-5 py-4 sm:px-6">
          <div><h3 className="text-base font-semibold">Items</h3><p className="mt-0.5 text-xs text-muted">Choose who shared each item.</p></div>
          <Button id="add-expense-item" type="button" variant="outline" size="sm" onClick={() => { setDirty(true); setError(null); setInvalidField(null); setItems((current) => [...current, { ...blankItem(), id: crypto.randomUUID() }]); }} className="min-h-11"><Plus size={15} aria-hidden="true" />Add item</Button>
        </div>
        <div className="divide-y divide-[#edf1ed]">
          {items.length === 0 && <div className="p-6 text-center"><p className="text-sm font-semibold">No items yet</p><p className="mt-1 text-sm text-muted">Add at least one item before saving this expense.</p><Button type="button" variant="outline" onClick={() => { setDirty(true); setError(null); setInvalidField(null); setItems([{ ...blankItem(), id: crypto.randomUUID() }]); }} className="mt-4 min-h-11"><Plus size={15} aria-hidden="true" />Add your first item</Button></div>}
          {items.map((item, index) => {
            const needsAssignment = unassignedItemIds.has(item.id);
            return <article key={item.id} className={`p-4 sm:p-5 ${needsAssignment ? "bg-[#fff9f7]" : "bg-white"}`}>
              <div className="mb-3 flex items-center justify-between gap-3"><h4 className="text-sm font-semibold">Item {index + 1}</h4><Button type="button" variant="ghost" size="icon" aria-label={`Remove item ${item.name.trim() || index + 1}`} title="Remove item" onClick={() => { setDirty(true); setError(null); setInvalidField(null); setItems((current) => removeDraftItem(current, item.id)); }} className="h-11 w-11 shrink-0 text-muted hover:bg-danger-soft hover:text-danger"><Trash2 size={16} aria-hidden="true" /></Button></div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_104px_138px]">
                <div><label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor={`item-name-${item.id}`}>Item name</label><Input id={`item-name-${item.id}`} maxLength={80} value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} placeholder="Product or dish" aria-invalid={invalidField === `item-name-${item.id}`} className={invalidField === `item-name-${item.id}` ? "border-danger ring-2 ring-danger/15" : ""} /></div>
                <div><label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor={`qty-${item.id}`}>Qty</label><Input id={`qty-${item.id}`} type="number" min="1" max="999" step="1" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} inputMode="numeric" aria-invalid={invalidField === `qty-${item.id}`} className={invalidField === `qty-${item.id}` ? "border-danger ring-2 ring-danger/15" : ""} /></div>
                <div><label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor={`price-${item.id}`}>Price each · {currency}</label><Input id={`price-${item.id}`} inputMode="decimal" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} placeholder={CURRENCY_DECIMALS[currency] === 0 ? "0" : "0.00"} aria-invalid={invalidField === `price-${item.id}`} className={invalidField === `price-${item.id}` ? "border-danger ring-2 ring-danger/15" : ""} /></div>
              </div>
              {item.noteOpen ? <div className="mt-3 rounded-xl bg-[#f7f9f6] p-3">
                <div className="flex items-center justify-between gap-2"><label htmlFor={`note-${item.id}`} className="text-xs font-semibold text-muted">Item note <span className="font-normal">· optional</span></label><button type="button" onClick={() => updateItem(item.id, { note: "", noteOpen: false })} className="inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-muted hover:bg-white hover:text-danger focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">Remove note</button></div>
                <textarea id={`note-${item.id}`} rows={2} maxLength={500} value={item.note} onChange={(event) => updateItem(item.id, { note: event.target.value })} placeholder="Add context, e.g. dairy-free or shared dessert" className="mt-2 min-h-16 w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-base text-foreground shadow-sm outline-none placeholder:text-[#87928b] focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-sm" />
                <p className="mt-1 text-right text-[11px] text-muted">{item.note.length}/500</p>
              </div> : <Button type="button" variant="ghost" size="sm" onClick={() => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, noteOpen: true } : entry))} className="mt-2 min-h-9 px-2 text-xs text-primary">+ Add Note</Button>}
              <fieldset id={`item-assignees-${item.id}`} tabIndex={-1} aria-invalid={needsAssignment || invalidField === `item-assignees-${item.id}`} aria-describedby={needsAssignment ? `item-assignment-warning-${item.id}` : undefined} className={`mt-4 rounded-lg ${invalidField === `item-assignees-${item.id}` ? "ring-2 ring-danger/20" : ""}`}>
                <legend className="mb-2 text-xs font-semibold text-muted">Shared by <span className="ml-1 font-normal">· {item.assignedMemberIds.filter((id) => memberIds.includes(id)).length} selected</span></legend>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`People sharing ${item.name.trim() || `item ${index + 1}`}`}>
                  {saved.members.map((member) => { const selected = item.assignedMemberIds.includes(member.id); return <button key={member.id} type="button" aria-pressed={selected} onClick={() => toggleMember(item, member.id)} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${selected ? "border-[#b8d0bf] bg-[#eaf1ec] text-primary" : "border-border bg-white text-muted hover:bg-surface-muted"}`}><span aria-hidden="true" className={`grid h-4 w-4 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-white" : "border-[#b6c1b9] bg-white"}`}>{selected && <Check size={11} strokeWidth={3} />}</span>{member.name}</button>; })}
                  <button type="button" disabled={saved.members.length === 0} aria-pressed={saved.members.length > 0 && saved.members.every((member) => item.assignedMemberIds.includes(member.id))} onClick={() => assignItemToEveryone(item)} className="inline-flex min-h-11 items-center rounded-full border border-dashed border-[#b8c6bb] px-3 text-xs font-semibold text-primary hover:bg-[#f3f7f3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50">Everyone</button>
                </div>
                {needsAssignment && <p id={`item-assignment-warning-${item.id}`} role="alert" className="mt-3 flex items-center gap-2 text-xs font-semibold text-danger"><AlertCircle size={15} aria-hidden="true" />Please select at least one person to split this item.</p>}
              </fieldset>
            </article>;
          })}
        </div>
      </Card>
    </div>

    <aside className="space-y-4 lg:sticky lg:top-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-2"><CircleDollarSign size={18} className="text-primary" aria-hidden="true" /><h3 className="text-base font-semibold">Tax and tip</h3></div>
        <p className="mt-1 text-xs leading-5 text-muted">Shared in proportion to each person’s item subtotal.</p>
        <div className="mt-4 grid grid-cols-2 gap-3"><div><label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor="expense-tax">Tax · {currency}</label><Input id="expense-tax" inputMode="decimal" value={tax} onChange={(event) => { setTax(event.target.value); setDirty(true); setError(null); setInvalidField(null); }} placeholder={CURRENCY_DECIMALS[currency] === 0 ? "0" : "0.00"} aria-invalid={invalidField === "expense-tax"} className={invalidField === "expense-tax" ? "border-danger ring-2 ring-danger/15" : ""} /></div><div><label className="mb-1.5 block text-xs font-semibold text-muted" htmlFor="expense-tip">Tip · {currency}</label><Input id="expense-tip" inputMode="decimal" value={tip} onChange={(event) => { setTip(event.target.value); setDirty(true); setError(null); setInvalidField(null); }} placeholder={CURRENCY_DECIMALS[currency] === 0 ? "0" : "0.00"} aria-invalid={invalidField === "expense-tip"} className={invalidField === "expense-tip" ? "border-danger ring-2 ring-danger/15" : ""} /></div></div>
        <div className="mt-5 rounded-xl bg-[#f7f9f6] p-4 text-sm">
          <div className="flex justify-between text-muted"><span>Items subtotal</span><span>{formatCents(subtotalCents, currency)}</span></div>
          <div className="mt-2 flex justify-between text-muted"><span>Tax</span><span>{formatCents(taxCents ?? 0, currency)}</span></div>
          <div className="mt-2 flex justify-between text-muted"><span>Tip</span><span>{formatCents(tipCents ?? 0, currency)}</span></div>
          <div className="my-3 border-t border-border" />
          <div className="flex items-baseline justify-between"><span className="font-semibold">Receipt total</span><strong className="text-xl font-semibold tracking-[-0.04em]">{formatCents(subtotalCents + (taxCents ?? 0) + (tipCents ?? 0), currency)}</strong></div>
          {preview ? <div className="mt-4 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Each person’s share</p>{saved.members.map((member) => <div key={member.id} className="flex justify-between py-1 text-sm"><span>{member.name}</span><span className="font-semibold">{formatCents(preview.get(member.id) ?? 0, currency)}</span></div>)}</div> : <p className="mt-3 text-xs leading-5 text-muted">Select people for each item to see the per-person split.</p>}
        </div>
      </Card>

      <Card className="p-4">
        <Button type="button" onClick={continueToSettlement} disabled={saving} size="lg" className="w-full">{saving ? "Saving expense…" : expenseStore.signedIn && !offline ? "Save to cloud & continue" : "Save & continue"}<ArrowRight size={16} aria-hidden="true" /></Button>
        <p className="mt-2 text-center text-[11px] leading-4 text-muted">You can review the final shares before settling.</p>
        <div className="mt-3 flex flex-col gap-1 border-t border-[#edf1ed] pt-3">
          <Button type="button" variant="ghost" onClick={leaveEditor} disabled={saving} className="min-h-11">Cancel</Button>
        </div>
      </Card>

      {pendingOfflineExpense && <p role="alert" className="rounded-xl border border-[#eadbb7] bg-warning-soft p-4 text-sm leading-5 text-[#75511e]">Cloud save failed; the cloud copy was not changed. <button type="button" disabled={saving} onClick={() => void persist(pendingOfflineExpense, "offline")} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#e2d4b2] bg-white px-3 text-xs font-semibold text-[#75511e] disabled:opacity-60">Save an offline copy<ArrowRight size={13} aria-hidden="true" /></button></p>}
    </aside>
    <FormErrorToast message={error} />
  </form>;
}
