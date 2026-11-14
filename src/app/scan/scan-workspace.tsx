"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { ReceiptReview, ReceiptScanResult } from "@/lib/receipt/extraction";
import type { Receipt, ReceiptItem } from "@/types";

type ReceiptRole = "itemized" | "payment";

type SelectedFile = {
  file: File;
  previewUrl: string;
};

type SelectedFiles = Record<ReceiptRole, SelectedFile | null>;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const receiptSlots: Array<{ role: ReceiptRole; label: string; description: string }> = [
  { role: "itemized", label: "Itemized Receipt", description: "Food, drinks, subtotal & tax" },
  { role: "payment", label: "Payment/Tip Receipt", description: "Tip & final charged amount" },
];

export default function ScanWorkspace() {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ itemized: null, payment: null });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [review, setReview] = useState<ReceiptReview | null>(null);
  const [isDragging, setIsDragging] = useState<ReceiptRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [tipManuallyEdited, setTipManuallyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scanRequestId = useRef(0);

  useEffect(() => {
    return () => {
      Object.values(selectedFiles).forEach((selectedFile) => {
        if (selectedFile) URL.revokeObjectURL(selectedFile.previewUrl);
      });
    };
  }, [selectedFiles]);

  const calculatedSubtotal = useMemo(
    () => receipt?.items.reduce((sum, item) => sum + item.total, 0) ?? 0,
    [receipt],
  );

  const calculatedTotal = useMemo(
    () => calculatedSubtotal + (receipt?.tax ?? 0) + (receipt?.tip ?? 0),
    [calculatedSubtotal, receipt?.tax, receipt?.tip],
  );

  const uploadCount = Number(Boolean(selectedFiles.itemized)) + Number(Boolean(selectedFiles.payment));
  const tipNeedsManualEntry = Boolean(receipt && receipt.tip === 0 && fieldNeedsReview("tip") && !tipManuallyEdited);

  function fieldNeedsReview(field: string) {
    return review?.fields.some((candidate) => candidate === field || candidate.startsWith(`${field}.`) || field.startsWith(`${candidate}.`)) ?? false;
  }

  async function scanReceipts(files: SelectedFiles) {
    const uploads = receiptSlots.filter((slot) => files[slot.role]);
    if (uploads.length === 0) return;

    const requestId = scanRequestId.current + 1;
    scanRequestId.current = requestId;
    setIsScanning(true);
    setReceipt(null);
    setReview(null);
    setTipManuallyEdited(false);
    setError(null);
    setNotice(`Analyzing ${uploads.length === 2 ? "both receipts" : "your receipt"} with OpenAI…`);

    try {
      const formData = new FormData();
      if (files.itemized) formData.append("itemizedFile", files.itemized.file);
      if (files.payment) formData.append("paymentFile", files.payment.file);

      const response = await fetch("/api/receipt/scan", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as Partial<ReceiptScanResult> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Receipt recognition failed.");
      if (!payload.receipt || !payload.review) throw new Error("Receipt recognition returned incomplete data.");
      if (requestId !== scanRequestId.current) return;

      setReceipt(payload.receipt);
      setReview(payload.review);
      setNotice(payload.review.needsConfirmation
        ? "Receipts recognized, but please confirm they belong to the same bill."
        : payload.review.needsReview
          ? "Receipt details merged. Check the highlighted fields before splitting."
          : uploads.length === 2
            ? "Both receipts merged. Check the details before sending them to your group."
            : "Receipt recognized. Check the details before sending it to your group.");
    } catch (scanError) {
      if (requestId !== scanRequestId.current) return;
      setReceipt(null);
      setReview(null);
      setError(scanError instanceof Error ? scanError.message : "Receipt recognition failed. Please try again.");
      setNotice(null);
    } finally {
      if (requestId === scanRequestId.current) setIsScanning(false);
    }
  }

  function handleFile(role: ReceiptRole, file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image of your receipt.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("That image is larger than 10 MB. Try a smaller photo.");
      return;
    }

    const selectedFile = { file, previewUrl: URL.createObjectURL(file) };
    const nextFiles = { ...selectedFiles, [role]: selectedFile };
    setSelectedFiles(nextFiles);
    setReceipt(null);
    setReview(null);
    setError(null);
    void scanReceipts(nextFiles);
  }

  function handleFileChange(role: ReceiptRole, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(role, file);
    event.target.value = "";
  }

  function handleDrop(role: ReceiptRole, event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(null);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(role, file);
  }

  function removeFile(role: ReceiptRole) {
    const nextFiles = { ...selectedFiles, [role]: null };
    setSelectedFiles(nextFiles);
    setReceipt(null);
    setReview(null);
    setError(null);
    if (nextFiles.itemized || nextFiles.payment) {
      void scanReceipts(nextFiles);
    } else {
      scanRequestId.current += 1;
      setIsScanning(false);
      setNotice(null);
    }
  }

  async function loadSampleReceipt() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/receipt");
      if (!response.ok) throw new Error("Could not load the demo receipt.");
      const sample = (await response.json()) as Receipt;
      setReceipt(sample);
      setReview(null);
      setTipManuallyEdited(false);
      setNotice("Demo extraction loaded. Check the details before sending it to your group.");
    } catch {
      setError("The demo receipt could not be loaded. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateReceipt(updates: Partial<Receipt>) {
    setReceipt((current) => (current ? { ...current, ...updates } : current));
  }

  function updateItem(itemId: string, updates: Partial<ReceiptItem>) {
    setReceipt((current) => {
      if (!current) return current;
      const items = current.items.map((item) => {
        if (item.id !== itemId) return item;
        const next = { ...item, ...updates };
        return { ...next, total: next.quantity * next.unitPrice };
      });
      return { ...current, items };
    });
  }

  function addItem() {
    setReceipt((current) => {
      if (!current) return current;
      const newItem: ReceiptItem = { id: `item-${Date.now()}`, name: "New item", quantity: 1, unitPrice: 0, total: 0, assignedMemberIds: [] };
      return { ...current, items: [...current.items, newItem] };
    });
  }

  function removeItem(itemId: string) {
    setReceipt((current) => current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current);
  }

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      <div className="space-y-5">
        <section className="rounded-[2rem] border border-[#ebe7de] bg-white p-5 shadow-[0_20px_60px_rgba(76,67,51,0.08)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#a19e93]">STEP 1</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Add your receipts</h2>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f7efe9] text-xl" aria-hidden="true">✦</span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {receiptSlots.map((slot) => {
              const selectedFile = selectedFiles[slot.role];
              return (
                <div key={slot.role} className="min-w-0">
                  <label
                    htmlFor={`${slot.role}-receipt-upload`}
                    onDragEnter={() => setIsDragging(slot.role)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDragging(null)}
                    onDrop={(event) => handleDrop(slot.role, event)}
                    className={`flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-4 text-center transition ${isDragging === slot.role ? "border-[#ed795d] bg-[#fff5f1]" : "border-[#dedbd1] bg-[#fbfaf7] hover:border-[#ed795d] hover:bg-[#fffaf7]"}`}
                  >
                    {selectedFile ? <img src={selectedFile.previewUrl} alt={`${slot.label} preview`} className="h-16 w-16 rounded-2xl object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-xl shadow-sm" aria-hidden="true">↑</span>}
                    <span className="mt-3 text-sm font-extrabold">{slot.label}</span>
                    <span className="mt-1 text-xs leading-5 text-[#929087]">{selectedFile ? `${(selectedFile.file.size / 1024 / 1024).toFixed(1)} MB · ${isScanning ? "analyzing…" : "ready"}` : slot.description}</span>
                    <input id={`${slot.role}-receipt-upload`} type="file" accept="image/*" onChange={(event) => handleFileChange(slot.role, event)} className="sr-only" />
                  </label>
                  {selectedFile && <button type="button" onClick={() => removeFile(slot.role)} className="mt-2 w-full text-xs font-bold text-[#99968d] hover:text-[#ed795d]">Remove {slot.label}</button>}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-[#929087]">Upload one receipt or both. We use the itemized receipt for items and tax, and the payment receipt for actual tip and charged total.</p>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#eeeae2]" />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#b0ada4]">or</span>
            <div className="h-px flex-1 bg-[#eeeae2]" />
          </div>

          <button type="button" onClick={loadSampleReceipt} disabled={isLoading || isScanning} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#e7e3da] px-4 text-sm font-extrabold transition hover:border-[#ed795d] hover:bg-[#fffaf7] disabled:cursor-wait disabled:opacity-60">
            {isLoading ? "Loading demo receipt…" : isScanning ? "Analyzing receipts…" : "Try a sample receipt"}
            {!isLoading && !isScanning && <span aria-hidden="true">↗</span>}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-[#a19e93]">Images are used for this scan and are not saved by this app.</p>
        </section>

        <div className="rounded-2xl border border-[#eadfcf] bg-[#fff8ea] px-5 py-4 text-sm leading-6 text-[#77684d]">
          <span className="mr-2" aria-hidden="true">✳</span>
          <strong>Secure recognition:</strong> OpenAI receives the uploaded images through the server route. Your API key stays in <code className="rounded bg-white/70 px-1">.env.local</code> and is never sent to the browser.
        </div>
      </div>

      <section className="rounded-[2rem] border border-[#ebe7de] bg-white p-5 shadow-[0_20px_60px_rgba(76,67,51,0.08)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#a19e93]">STEP 2</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Check the details</h2>
          </div>
          {receipt && (review?.needsConfirmation ? <span className="rounded-full bg-[#fff0ed] px-3 py-1.5 text-xs font-bold text-[#b64e3a]">Confirm receipts</span> : review?.needsReview ? <span className="rounded-full bg-[#fff3d5] px-3 py-1.5 text-xs font-bold text-[#8a6d2f]">Needs review</span> : <span className="rounded-full bg-[#edf1e8] px-3 py-1.5 text-xs font-bold text-[#687957]">Ready to split ✓</span>)}
        </div>

        {isScanning && <p role="status" className="mt-5 rounded-2xl bg-[#fff8ea] px-4 py-3 text-sm font-semibold leading-6 text-[#77684d]">OpenAI is reading {uploadCount === 2 ? "both receipts" : "your receipt"}. This can take a few seconds…</p>}
        {notice && <p className="mt-5 rounded-2xl bg-[#f7f6f1] px-4 py-3 text-sm leading-6 text-[#77766d]">{notice}</p>}
        {error && <p role="alert" className="mt-5 rounded-2xl bg-[#fff0ed] px-4 py-3 text-sm font-semibold leading-6 text-[#b64e3a]">{error}</p>}
        {review?.needsConfirmation && <div className="mt-5 rounded-2xl border border-[#e6a095] bg-[#fff5f2] px-4 py-3 text-sm leading-6 text-[#8d4135]"><strong>Confirm these receipts belong to the same bill.</strong> {review.notes.filter((note) => /receipt|transaction|merchant|date|total/i.test(note)).join(" ")}</div>}
        {review?.needsReview && <div className="mt-5 rounded-2xl border border-[#e6c66f] bg-[#fffaf0] px-4 py-3 text-sm leading-6 text-[#77684d]"><strong>Review highlighted fields.</strong> {review.notes.join(" ")}</div>}

        {!receipt ? (
          <div className="grid min-h-[28rem] place-items-center rounded-3xl bg-[#fbfaf7] px-8 text-center">
            <div>
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-2xl shadow-sm" aria-hidden="true">⌁</span>
              <h3 className="mt-5 text-lg font-extrabold">Your combined bill will show here</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#929087]">Upload one or both receipts to review the merchant, items, tax, tip, and final charged amount.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#99968d]">Merchant</span>
                <input value={receipt.merchant} aria-invalid={fieldNeedsReview("merchant")} onChange={(event) => updateReceipt({ merchant: event.target.value })} className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-bold outline-none transition focus:border-[#ed795d] focus:ring-4 focus:ring-[#ed795d]/10 ${fieldNeedsReview("merchant") ? "border-[#e6c66f] bg-[#fffaf0]" : "border-[#e7e3da] bg-[#fbfaf7]"}`} />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#99968d]">Date</span>
                <input type="date" value={receipt.date} aria-invalid={fieldNeedsReview("date")} onChange={(event) => updateReceipt({ date: event.target.value })} className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-bold outline-none transition focus:border-[#ed795d] focus:ring-4 focus:ring-[#ed795d]/10 ${fieldNeedsReview("date") ? "border-[#e6c66f] bg-[#fffaf0]" : "border-[#e7e3da] bg-[#fbfaf7]"}`} />
              </label>
            </div>

            <div className="rounded-3xl bg-[#fbfaf7] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold">Items</h3><button type="button" onClick={addItem} className="text-xs font-extrabold text-[#ed795d] hover:text-[#d95f45]">+ Add item</button></div>
              <div className="space-y-3">
                {receipt.items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_auto] items-center gap-2 border-b border-[#eae7df] pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]">
                    <label className="min-w-0"><span className="sr-only">Item name</span><input value={item.name} aria-invalid={fieldNeedsReview(`items[${index}].name`)} onChange={(event) => updateItem(item.id, { name: event.target.value })} className={`min-h-10 w-full min-w-0 rounded-xl border px-3 text-sm font-bold outline-none transition focus:border-[#ed795d] ${fieldNeedsReview(`items[${index}].name`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <label><span className="sr-only">Quantity for {item.name}</span><input type="number" min="1" step="1" value={item.quantity} aria-invalid={fieldNeedsReview(`items[${index}].quantity`)} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className={`min-h-10 w-full rounded-xl border px-2 text-center text-sm outline-none transition focus:border-[#ed795d] ${fieldNeedsReview(`items[${index}].quantity`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <label><span className="sr-only">Price for {item.name}</span><input type="number" min="0" step="0.01" value={item.unitPrice} aria-invalid={fieldNeedsReview(`items[${index}].unit_price`)} onChange={(event) => updateItem(item.id, { unitPrice: Math.max(0, Number(event.target.value) || 0) })} className={`min-h-10 w-full rounded-xl border px-2 text-right text-sm font-bold outline-none transition focus:border-[#ed795d] ${fieldNeedsReview(`items[${index}].unit_price`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <button type="button" onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-xl text-lg text-[#b6b2a8] hover:bg-white hover:text-[#ed795d]" aria-label={`Remove ${item.name}`}>×</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#aaa69c] sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]"><span /><span className="text-center">Qty</span><span className="text-right">Each</span><span /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl bg-[#f7f6f1] px-4 py-3 text-sm text-[#77766d]"><span>Tax</span><span className="flex items-center gap-1 font-bold text-[#25251f]"><span>$</span><input type="number" min="0" step="0.01" value={receipt.tax} aria-invalid={fieldNeedsReview("tax")} onChange={(event) => updateReceipt({ tax: Math.max(0, Number(event.target.value) || 0) })} className={`w-16 rounded px-1 text-right outline-none ${fieldNeedsReview("tax") ? "bg-[#fffaf0]" : "bg-transparent"}`} /></span></label>
              <label className="flex items-center justify-between rounded-2xl bg-[#f7f6f1] px-4 py-3 text-sm text-[#77766d]"><span>Tip</span><span className="flex items-center gap-1 font-bold text-[#25251f]"><span>$</span><input type="number" min="0" step="0.01" placeholder="Enter" value={tipNeedsManualEntry ? "" : receipt.tip} aria-invalid={fieldNeedsReview("tip")} onChange={(event) => { setTipManuallyEdited(true); updateReceipt({ tip: event.target.value === "" ? 0 : Math.max(0, Number(event.target.value) || 0) }); }} className={`w-20 rounded px-1 text-right outline-none placeholder:text-[#aaa69c] ${fieldNeedsReview("tip") ? "bg-[#fffaf0]" : "bg-transparent"}`} /></span></label>
            </div>

            <div className={`rounded-3xl p-5 text-white ${fieldNeedsReview("total") ? "border-2 border-[#e6c66f] bg-[#302d24]" : "bg-[#25251f]"}`}>
              <div className="flex items-center justify-between text-sm text-[#c7c4bb]"><span>Subtotal</span><span>{money.format(calculatedSubtotal)}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#c7c4bb]"><span>Tax &amp; tip</span><span>{money.format(receipt.tax + receipt.tip)}</span></div>
              <div className="my-4 border-t border-white/15" />
              <div className="flex items-end justify-between"><span className="font-bold">Charged total</span><strong className="text-3xl font-extrabold tracking-tight">{money.format(receipt.total)}</strong></div>
              {Math.abs(receipt.total - calculatedTotal) > 0.05 && <p className="mt-3 text-xs leading-5 text-[#f4d578]">Calculated from the editable fields: {money.format(calculatedTotal)}. Confirm the discrepancy above.</p>}
            </div>

            <button type="button" className="min-h-14 w-full rounded-2xl bg-[#ed795d] px-6 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(237,121,93,0.2)] transition hover:-translate-y-0.5 hover:bg-[#e86b4e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed795d]">Continue to split <span aria-hidden="true">→</span></button>
            <p className="text-center text-xs leading-5 text-[#a19e93]">Next, you’ll assign each item to people in your group.</p>
          </div>
        )}
      </section>
    </div>
  );
}
