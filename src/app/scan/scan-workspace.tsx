"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n";
import { AuthSessionInvalidError, useAuth } from "@/components/groups/auth-provider";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import { createReceiptExpenseDraft, receiptDraftStorageKey } from "@/lib/receipt/draft";
import { getScanErrorTranslationKey } from "@/lib/receipt/scan-errors";
import { MAX_SCAN_FILE_BYTES, MAX_SCAN_TOTAL_FILE_BYTES } from "@/lib/receipt/upload-validation";
import { groupExpenseHref } from "@/lib/groups/form";
import type { ReceiptReview, ReceiptScanResult } from "@/lib/receipt/extraction";
import { CURRENCY_CODES, CURRENCY_DECIMALS, CURRENCY_LABELS, type CurrencyCode } from "@/lib/currency/types";
import { CurrencyAmount } from "@/components/currency";
import { parseMoneyToMinorUnits } from "@/lib/expenses/calculations";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { Receipt, ReceiptItem } from "@/types";

type ReceiptRole = "itemized" | "payment";

type SelectedFile = {
  file: File;
  previewUrl: string;
};

type SelectedFiles = Record<ReceiptRole, SelectedFile | null>;

function formatMoney(value: number, currency: CurrencyCode) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: CURRENCY_DECIMALS[currency] }).format(value);
}
const MAX_ORIGINAL_IMAGE_BYTES = 16 * 1024 * 1024;

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser couldn’t prepare the image. Try another image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("This browser couldn’t prepare the image. Try another image.")), "image/jpeg", 0.82));
    if (blob.size > MAX_SCAN_FILE_BYTES) throw new Error("This image is still too large after compression. Choose a smaller photo.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "receipt"}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}

function localizeServerError(message: string, t: Translator, code?: string) {
  const translationKey = getScanErrorTranslationKey(code);
  if (translationKey) return t(translationKey);
  if (message.includes("not configured")) return t("error.notConfigured");
  if (message.includes("Upload an itemized receipt")) return t("error.noUploads");
  if (message.includes("must be a JPEG")) {
    const label = message.split(" must be a JPEG")[0];
    return t("error.invalidType", { label });
  }
  if (message.includes("must be between 1 byte")) {
    const label = message.split(" must be between 1 byte")[0];
    return t("error.invalidSize", { label });
  }
  if (message.includes("returned no receipt data")) return t("error.noReceiptData");
  if (message.includes("returned an invalid receipt response")) return t("error.invalidReceiptResponse");
  if (message.includes("Receipt recognition failed")) return t("error.tryAgain");
  return message;
}

function localizeReviewNote(note: string, t: Translator) {
  if (note.startsWith("These receipts may not belong")) return t("review.mismatch");
  if (note.startsWith("I could not confidently confirm")) return t("review.mismatchUnknown");
  if (note.startsWith("Merchant names differ")) return t("review.merchantMismatch");
  if (note.startsWith("Dates differ")) return t("review.dateMismatch");
  if (note.startsWith("Merchant name is missing")) return t("review.merchantMissing");
  if (note.startsWith("Receipt date is missing")) return t("review.dateMissing");
  if (note.startsWith("Date format could not")) return t("review.dateInvalid");
  if (note.startsWith("No itemized receipt was detected")) return t("review.noItemized");
  if (note.startsWith("Itemized subtotal is missing")) return t("review.itemMissing");
  if (note.startsWith("Itemized tax is missing")) return t("review.taxMissing");
  if (note.startsWith("The itemized receipt has lower-confidence")) return t("review.itemizedLowConfidence");
  if (note.startsWith("No clearly itemized receipt")) return t("review.receiptMissing");
  if (note.startsWith("The payment receipt has a blank tip")) return t("review.tipBlank");
  if (note.startsWith("The payment receipt shows suggested")) return t("review.tipSuggested");
  if (note.startsWith("The payment receipt tip line is unclear")) return t("review.tipUnclear");
  if (note.startsWith("No confirmed actual tip")) return t("review.tipMissing");
  if (note.startsWith("No actual tip amount")) return t("review.tipNotPresent");
  if (note.startsWith("The two receipts show different tip")) return t("review.tipConflict");
  if (note.startsWith("Final charged total is missing or unreadable on the payment")) return t("review.totalMissingPayment");
  if (note.startsWith("Final charged total is missing")) return t("review.totalMissing");
  if (note.startsWith("The charged total differs")) return t("review.totalDifference");

  const totalConflictMatch = note.match(/^The payment receipt total \(([^)]+)\) conflicts with the itemized receipt total \(([^)]+)\)/);
  if (totalConflictMatch) return t("review.totalConflict", { payment: totalConflictMatch[1], itemized: totalConflictMatch[2] });

  const itemMatch = note.match(/^Item (\d+) name is missing/);
  if (itemMatch) return t("review.itemNameMissing", { item: itemMatch[1] });
  const quantityMatch = note.match(/^Quantity for item (\d+) is missing/);
  if (quantityMatch) return t("review.itemQuantityMissing", { item: quantityMatch[1] });
  const priceMatch = note.match(/^Unit price for item (\d+) is missing/);
  if (priceMatch) return t("review.itemPriceMissing", { item: priceMatch[1] });
  const totalMatch = note.match(/^Line total for item (\d+) is missing/);
  if (totalMatch) return t("review.itemTotalMissing", { item: totalMatch[1] });
  const mismatchMatch = note.match(/^Line total for item (\d+) does not match/);
  if (mismatchMatch) return t("review.itemTotalMismatch", { item: mismatchMatch[1] });
  const checkMatch = note.match(/^Item (\d+) should be checked/);
  if (checkMatch) return t("review.itemCheck", { item: checkMatch[1] });

  return t("review.receiptNote");
}

export default function ScanWorkspace({ initialGroupId }: { initialGroupId: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const { groups, loading: groupsLoading } = useSavedGroups();
  const [groupId, setGroupId] = useState(initialGroupId);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ itemized: null, payment: null });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptCurrency, setReceiptCurrency] = useState<CurrencyCode>("USD");
  const [review, setReview] = useState<ReceiptReview | null>(null);
  const [isDragging, setIsDragging] = useState<ReceiptRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [tipManuallyEdited, setTipManuallyEdited] = useState(false);
  const [receiptReviewed, setReceiptReviewed] = useState(false);
  const [transactionConfirmed, setTransactionConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scanRequestId = useRef(0);
  const photoInputRefs = useRef<Partial<Record<ReceiptRole, HTMLInputElement | null>>>({});
  const uploadInputRefs = useRef<Partial<Record<ReceiptRole, HTMLInputElement | null>>>({});

  useEffect(() => setGroupId(initialGroupId), [initialGroupId]);

  const receiptSlots: Array<{ role: ReceiptRole; label: string; description: string }> = [
    { role: "itemized", label: t("scan.itemizedReceipt"), description: t("scan.itemizedDescription") },
    { role: "payment", label: t("scan.paymentReceipt"), description: t("scan.paymentDescription") },
  ];

  const previewUrls = useRef(new Set<string>());
  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

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
  const activeGroup = groups.find((entry) => entry.group.id === groupId);

  function fieldNeedsReview(field: string) {
    return review?.fields.some((candidate) => candidate === field || candidate.startsWith(`${field}.`) || field.startsWith(`${candidate}.`)) ?? false;
  }

  async function scanReceipts(files: SelectedFiles) {
    const uploads = receiptSlots.filter((slot) => files[slot.role]);
    if (uploads.length === 0) return;
    if (!groupId) { setError("Choose a group before scanning a receipt."); return; }
    if (!activeGroup || groupsLoading) { setError("Choose a group that is available in the current account."); return; }
    const requestId = scanRequestId.current + 1;
    scanRequestId.current = requestId;
    setIsScanning(true);
    setReceipt(null);
    setReview(null);
    setReceiptCurrency("USD");
    setTipManuallyEdited(false);
    setReceiptReviewed(false);
    setTransactionConfirmed(false);
    setError(null);
    setNotice(t("scan.readingReceipts", { receipts: uploads.length === 2 ? t("scan.bothReceipts") : t("scan.yourReceipt") }));

    try {
      let accessToken: string | null;
      try {
        accessToken = await getAccessToken();
      } catch (authError) {
        if (authError instanceof AuthSessionInvalidError) throw new Error(t("error.authInvalid"));
        throw new Error(t("error.authUnavailable"));
      }
      if (!accessToken) throw new Error(t("error.notAuthenticated"));

      const formData = new FormData();
      formData.append("groupId", groupId);
      if (files.itemized) formData.append("itemizedFile", files.itemized.file);
      if (files.payment) formData.append("paymentFile", files.payment.file);

      const response = await fetch("/api/receipt/scan", {
        method: "POST",
        credentials: "same-origin",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ReceiptScanResult> & { error?: string; code?: string };
      if (!response.ok) throw new Error(localizeServerError(payload.error || t("error.recognitionFailed"), t, payload.code));
      if (!payload.receipt || !payload.review) throw new Error(t("error.incompleteResponse"));
      if (requestId !== scanRequestId.current) return;

      setReceipt(payload.receipt);
      setReview(payload.review);
      setReceiptReviewed(false);
      setTransactionConfirmed(false);
      setNotice(payload.review.needsConfirmation
        ? t("scan.noticeConfirm")
        : payload.review.needsReview
          ? t("scan.noticeReview")
          : uploads.length === 2
            ? t("scan.noticeBothMerged")
            : t("scan.noticeOneRecognized"));
    } catch (scanError) {
      if (requestId !== scanRequestId.current) return;
      setReceipt(null);
      setReview(null);
      setError(scanError instanceof TypeError ? t("error.network") : scanError instanceof Error ? scanError.message : t("error.tryAgain"));
      setNotice(null);
    } finally {
      if (requestId === scanRequestId.current) setIsScanning(false);
    }
  }

  async function handleFile(role: ReceiptRole, file: File) {
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
      setError(t("error.unsupportedImage"));
      return;
    }

    if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
      setError("Choose an image smaller than 16 MB before compression.");
      return;
    }

    if (groupsLoading) { setError("Wait for group status to finish loading, then try again."); return; }
    if (!groupId || !activeGroup) { setError("Choose a group that is available in the current account before uploading."); return; }

    setIsLoading(true);
    setError(null);
    try {
      const optimized = await compressImage(file);
      const nextSize = Object.entries(selectedFiles).reduce((total, [existingRole, selected]) => total + (existingRole === role || !selected ? 0 : selected.file.size), optimized.size);
      if (nextSize > MAX_SCAN_TOTAL_FILE_BYTES) throw new Error("Together, these receipt images are too large. Choose smaller photos.");
      const selectedFile = { file: optimized, previewUrl: URL.createObjectURL(optimized) };
      previewUrls.current.add(selectedFile.previewUrl);
      const previous = selectedFiles[role];
      if (previous) {
        URL.revokeObjectURL(previous.previewUrl);
        previewUrls.current.delete(previous.previewUrl);
      }
      const nextFiles = { ...selectedFiles, [role]: selectedFile };
      setSelectedFiles(nextFiles);
      setReceipt(null);
      setReview(null);
      setReceiptReviewed(false);
      setTransactionConfirmed(false);
      setNotice(t("scan.readyToScan"));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("error.tryAgain"));
    } finally {
      setIsLoading(false);
    }
  }

  function handleFileChange(role: ReceiptRole, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(role, file);
    event.target.value = "";
  }

  function handleDrop(role: ReceiptRole, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(null);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(role, file);
  }

  function removeFile(role: ReceiptRole) {
    const nextFiles = { ...selectedFiles, [role]: null };
    if (selectedFiles[role]) {
      URL.revokeObjectURL(selectedFiles[role].previewUrl);
      previewUrls.current.delete(selectedFiles[role].previewUrl);
    }
    setSelectedFiles(nextFiles);
    setReceipt(null);
    setReview(null);
    setReceiptReviewed(false);
    setTransactionConfirmed(false);
    setError(null);
    if (nextFiles.itemized || nextFiles.payment) {
      setNotice(t("scan.readyToScan"));
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
      if (!response.ok) throw new Error(t("error.demoLoad"));
      const sample = (await response.json()) as Receipt;
      setReceipt(sample);
      setReceiptCurrency("USD");
      setReview(null);
      setTipManuallyEdited(false);
      setReceiptReviewed(false);
      setTransactionConfirmed(false);
      setNotice(t("scan.noticeDemoLoaded"));
    } catch {
      setError(t("error.demoLoadTryAgain"));
    } finally {
      setIsLoading(false);
    }
  }

  function updateReceipt(updates: Partial<Receipt>) {
    setReceiptReviewed(false);
    setReceipt((current) => (current ? { ...current, ...updates } : current));
  }

  function updateItem(itemId: string, updates: Partial<ReceiptItem>) {
    setReceiptReviewed(false);
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
      const newItem: ReceiptItem = { id: `item-${Date.now()}`, name: t("scan.newItem"), quantity: 1, unitPrice: 0, total: 0, assignedMemberIds: [] };
      return { ...current, items: [...current.items, newItem] };
    });
  }

  function removeItem(itemId: string) {
    setReceipt((current) => current ? { ...current, items: current.items.filter((item) => item.id !== itemId) } : current);
    setReceiptReviewed(false);
  }

  function continueToExpenseForm() {
    setError(null);
    if (!receipt) { setError("Scan or load a receipt before continuing."); return; }
    if (!groupId || !activeGroup) { setError("Choose a group that is available in this account before continuing."); return; }
    if (tipNeedsManualEntry) { setError(`Confirm the actual tip amount or enter ${formatMoney(0, receiptCurrency)} before continuing.`); return; }
    if (!receiptReviewed) { setError("Review the extracted items and amounts, then confirm before continuing."); return; }
    if (review?.needsConfirmation && !transactionConfirmed) { setError("Confirm that the uploaded receipts belong to the same transaction before continuing."); return; }
    try {
      const draft = createReceiptExpenseDraft(receipt, groupId, new Date(), receiptCurrency);
      window.sessionStorage.setItem(receiptDraftStorageKey(groupId), JSON.stringify(draft));
      router.push(`${groupExpenseHref(groupId)}?fromScan=1`);
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "The reviewed receipt could not be prepared for splitting.");
    }
  }

  return (
    <div className="relative mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
      {!groupId ? <section className="rounded-2xl border border-border bg-white p-4 sm:col-span-2 sm:p-5">
        <label htmlFor="scan-group" className="block text-sm font-semibold">Choose a group for this receipt</label>
        {groupsLoading ? <p role="status" className="mt-2 text-sm text-muted">Loading your groups…</p> : groups.length ? <select id="scan-group" value={groupId} onChange={(event) => setGroupId(event.target.value)} className="mt-2 h-11 w-full max-w-md rounded-xl border border-border bg-white px-3 text-base sm:text-sm"><option value="">Choose a group</option>{groups.map((entry) => <option key={entry.group.id} value={entry.group.id}>{entry.group.name}</option>)}</select> : <p className="mt-2 text-sm text-muted">Create a group before scanning a receipt. <Link href="/groups" className="font-semibold text-primary underline">Go to groups</Link></p>}
      </section> : <section className="rounded-2xl border border-border bg-white px-4 py-3 text-sm sm:col-span-2"><span className="font-semibold">Group:</span> {groupsLoading ? "Loading…" : activeGroup?.group.name ?? "This group is not available in the current account."}</section>}
      <div className="space-y-5">
        <section className="scan-card rounded-[2rem] border border-[#ebe7de] bg-white p-5 shadow-[0_20px_60px_rgba(76,67,51,0.08)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#a19e93]">{t("scan.step1")} <span className="ml-1 text-[#ed795d]">{t("scan.step1Accent")}</span></p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-[1.7rem]">{t("scan.addReceipts")}</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#929087]">{t("scan.addReceiptsDescription")}</p>
            </div>
            <Image src="/mascots/pip-receipt.png" alt="" width={132} height={121} className="h-14 w-14 shrink-0 object-contain drop-shadow-[0_8px_12px_rgba(111,77,65,0.12)]" aria-hidden="true" />
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {receiptSlots.map((slot) => {
              const selectedFile = selectedFiles[slot.role];
              return (
                <div key={slot.role} className="min-w-0">
                  <div
                    onDragEnter={() => setIsDragging(slot.role)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDragging(null)}
                    onDrop={(event) => handleDrop(slot.role, event)}
                    className={`group relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-[1.65rem] border-2 border-dashed px-4 text-center transition duration-300 ${isDragging === slot.role ? "border-[#ed795d] bg-[#fff5f1] shadow-[0_14px_30px_rgba(237,121,93,0.12)]" : "border-[#dedbd1] bg-[#fbfaf7]"}`}
                  >
                    <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#f7d7c9]/40 transition duration-300 group-hover:scale-125" aria-hidden="true" />
                    {selectedFile ? <img src={selectedFile.previewUrl} alt={`${slot.label} preview`} className="relative h-16 w-16 rounded-2xl object-cover shadow-[0_8px_18px_rgba(76,67,51,0.14)]" /> : <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white text-xl text-[#ed795d] shadow-[0_8px_18px_rgba(76,67,51,0.08)] transition duration-300 group-hover:rotate-3 group-hover:scale-105" aria-hidden="true">↑</span>}
                    <span className="relative mt-4 text-sm font-extrabold tracking-[-0.01em]">{slot.label}</span>
                    <span className="relative mt-1 text-xs leading-5 text-[#929087]">{selectedFile ? `${(selectedFile.file.size / 1024 / 1024).toFixed(1)} MB · ${isScanning ? t("scan.analyzingReceipts") : t("scan.readyToReview")}` : slot.description}</span>
                    {!selectedFile && <span className="relative mt-3 text-xs font-semibold text-[#a19e93]">{t("scan.chooseImage")}</span>}
                  </div>
                  <input ref={(element) => { photoInputRefs.current[slot.role] = element; }} id={`${slot.role}-camera-input`} type="file" accept="image/*" capture="environment" onChange={(event) => handleFileChange(slot.role, event)} className="sr-only" />
                  <input ref={(element) => { uploadInputRefs.current[slot.role] = element; }} id={`${slot.role}-upload-input`} type="file" accept="image/*" onChange={(event) => handleFileChange(slot.role, event)} className="sr-only" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => photoInputRefs.current[slot.role]?.click()} disabled={isLoading || isScanning} className="min-h-11 rounded-xl border border-border bg-white px-2 text-sm font-semibold text-primary transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60" aria-label={`${t("scan.takePhoto")} — ${slot.label}`}>{t("scan.takePhoto")}</button>
                    <button type="button" onClick={() => uploadInputRefs.current[slot.role]?.click()} disabled={isLoading || isScanning} className="min-h-11 rounded-xl border border-border bg-white px-2 text-sm font-semibold text-primary transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60" aria-label={`${t("scan.uploadImage")} — ${slot.label}`}>{t("scan.uploadImage")}</button>
                  </div>
                  {selectedFile && <button type="button" onClick={() => removeFile(slot.role)} aria-label={`Remove ${slot.label}`} className="mt-2 min-h-10 w-full rounded-xl py-1.5 text-xs font-bold text-[#99968d] transition hover:bg-[#fff5f1] hover:text-[#ed795d]">{t("scan.remove", { label: slot.label })}</button>}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-[#929087]">JPEG, PNG, or WEBP · each image is compressed to fit the 4 MB secure request limit.</p>
          <p className="mt-2 text-center text-xs leading-5 text-[#929087]">{t("scan.cameraFallback")}</p>
          {!user && !authLoading && <p role="status" className="mt-4 rounded-xl border border-[#eadbb7] bg-warning-soft px-3.5 py-3 text-sm leading-5 text-[#75511e]">Sign in with the account that owns this group to use paid receipt scanning. You can still load the local sample.</p>}
          {!activeGroup && !groupsLoading && groupId && <p role="alert" className="mt-4 rounded-xl border border-[#f0d3cd] bg-danger-soft px-3.5 py-3 text-sm leading-5 text-danger">This group is unavailable to the current account. Return to Groups and open the group again.</p>}

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#eeeae2]" />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#b0ada4]">{t("scan.or")}</span>
            <div className="h-px flex-1 bg-[#eeeae2]" />
          </div>

          <button type="button" onClick={loadSampleReceipt} disabled={isLoading || isScanning} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#e7e3da] bg-white px-4 text-sm font-extrabold transition duration-200 hover:-translate-y-0.5 hover:border-[#ed795d] hover:bg-[#fffaf7] hover:shadow-[0_10px_22px_rgba(76,67,51,0.07)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed795d] disabled:cursor-wait disabled:opacity-60">
            {isLoading ? t("scan.loadingDemo") : isScanning ? t("scan.analyzingReceipts") : t("scan.trySample")}
            {!isLoading && !isScanning && <span aria-hidden="true">↗</span>}
          </button>
          {uploadCount > 0 && !isScanning && <div className="mt-3">
            <p className="mb-2 text-center text-xs text-muted">{t("scan.scanUsageNote")}</p>
            <button type="button" onClick={() => void scanReceipts(selectedFiles)} disabled={isLoading || isScanning} className="min-h-12 w-full rounded-xl bg-primary px-4 text-sm font-bold text-white transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50">{receipt ? t("scan.rescanWithAI") : t("scan.scanWithAI")}</button>
          </div>}

          <p className="mt-4 text-center text-xs leading-5 text-[#a19e93]">{t("scan.imagesNotice")}</p>
        </section>

        <div className="rounded-2xl border border-[#eadfcf] bg-[#fff8ea] px-5 py-4 text-sm leading-6 text-[#77684d] shadow-[0_8px_24px_rgba(129,104,59,0.06)]">
          <span className="mr-2" aria-hidden="true">✳</span>
          <strong>{t("scan.secureRecognition")}</strong> {t("scan.secureRecognitionDetail")}
        </div>
      </div>

      <section className="scan-card rounded-[2rem] border border-[#ebe7de] bg-white p-5 shadow-[0_20px_60px_rgba(76,67,51,0.08)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#a19e93]">{t("scan.step2")} <span className="ml-1 text-[#ed795d]">{t("scan.step2Accent")}</span></p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] sm:text-[1.7rem]">{t("scan.checkDetails")}</h2>
          </div>
          {receipt && (review?.needsConfirmation ? <span className="rounded-full bg-[#fff0ed] px-3 py-1.5 text-xs font-bold text-[#b64e3a]">{t("scan.confirmReceipts")}</span> : review?.needsReview ? <span className="rounded-full bg-[#fff3d5] px-3 py-1.5 text-xs font-bold text-[#8a6d2f]">{t("scan.needsReview")}</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf1e8] px-3 py-1.5 text-xs font-bold text-[#687957]"><Image src="/mascots/pip-receipt.png" alt="" width={40} height={37} className="h-5 w-5 object-contain" aria-hidden="true" />{t("scan.readyToSplit")}</span>)}
        </div>

        {isScanning && <div role="status" className="mt-5 flex items-center gap-3 rounded-2xl bg-[#fff8ea] px-4 py-3 text-sm font-semibold leading-6 text-[#77684d]"><Image src="/mascots/pip-receipt.png" alt="" width={96} height={88} className="h-12 w-12 shrink-0 object-contain" aria-hidden="true" /><span><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#ed795d]" />{t("scan.readingReceipts", { receipts: uploadCount === 2 ? t("scan.bothReceipts") : t("scan.yourReceipt") })}</span></div>}
        {notice && <p className="mt-5 rounded-2xl border border-[#ece9e2] bg-[#f7f6f1] px-4 py-3 text-sm leading-6 text-[#77766d]">{notice}</p>}
        {error && <p role="alert" className="mt-5 rounded-2xl border border-[#f0c2b8] bg-[#fff0ed] px-4 py-3 text-sm font-semibold leading-6 text-[#b64e3a]">{error}</p>}
        {review?.needsConfirmation && <div className="mt-5 rounded-2xl border border-[#e6a095] bg-[#fff5f2] px-4 py-3 text-sm leading-6 text-[#8d4135]"><strong>{t("scan.confirmMessage")}</strong> {review.notes.filter((note) => /receipt|transaction|merchant|date|total/i.test(note)).map((note) => localizeReviewNote(note, t)).join(" ")}</div>}
        {review?.needsReview && <div className="mt-5 rounded-2xl border border-[#e6c66f] bg-[#fffaf0] px-4 py-3 text-sm leading-6 text-[#77684d]"><strong>{t("scan.reviewMessage")}</strong> {review.notes.map((note) => localizeReviewNote(note, t)).join(" ")}</div>}

        {!receipt ? (
          <div className="grid min-h-[28rem] place-items-center rounded-[1.65rem] border border-dashed border-[#e4e0d7] bg-[#fbfaf7] px-8 text-center">
            <div>
              <Image src="/mascots/pip-receipt.png" alt={t("scan.pipAlt")} width={176} height={161} className="mx-auto h-24 w-24 object-contain drop-shadow-[0_12px_18px_rgba(111,77,65,0.12)]" />
              <h3 className="mt-5 text-lg font-extrabold tracking-[-0.02em]">{t("scan.emptyTitle")}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[#929087]">{t("scan.emptyDescription")}</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5 scan-fade-in">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <label className="block">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#99968d]">{t("scan.merchant")}</span>
                <input value={receipt.merchant} aria-invalid={fieldNeedsReview("merchant")} onChange={(event) => updateReceipt({ merchant: event.target.value })} className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-bold outline-none transition duration-200 focus:border-[#ed795d] focus:bg-white focus:ring-4 focus:ring-[#ed795d]/10 ${fieldNeedsReview("merchant") ? "border-[#e6c66f] bg-[#fffaf0]" : "border-[#e7e3da] bg-[#fbfaf7]"}`} />
              </label>
              <label className="block">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#99968d]">{t("scan.date")}</span>
                <input type="date" value={receipt.date} aria-invalid={fieldNeedsReview("date")} onChange={(event) => updateReceipt({ date: event.target.value })} className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-bold outline-none transition duration-200 focus:border-[#ed795d] focus:bg-white focus:ring-4 focus:ring-[#ed795d]/10 ${fieldNeedsReview("date") ? "border-[#e6c66f] bg-[#fffaf0]" : "border-[#e7e3da] bg-[#fbfaf7]"}`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#99968d]">{t("currency.receipt")}</span>
                <select value={receiptCurrency} onChange={(event) => { setReceiptCurrency(event.target.value as CurrencyCode); setReceiptReviewed(false); }} className="mt-2 min-h-12 w-full rounded-2xl border border-[#e7e3da] bg-[#fbfaf7] px-4 text-sm font-bold focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10">
                  {CURRENCY_CODES.map((code) => <option key={code} value={code}>{CURRENCY_LABELS[code]}</option>)}
                </select>
                <span className="mt-1 block text-xs text-muted">Confirm the currency printed on the receipt before splitting.</span>
              </label>
            </div>

            <div className="rounded-3xl border border-[#eeeae2] bg-[#fbfaf7] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-extrabold">{t("scan.items")}</h3><p className="mt-1 text-xs text-[#aaa69c]">{t("scan.editMissed")}</p></div><button type="button" onClick={addItem} className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-[#ed795d] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff5f1] hover:text-[#d95f45]">{t("scan.addItem")}</button></div>
              <div className="space-y-3">
                {receipt.items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_4.25rem_5rem_auto] items-center gap-2 border-b border-[#eae7df] pb-3 transition last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]">
                    <label className="min-w-0"><span className="sr-only">{t("scan.itemNameAria")}</span><input value={item.name} aria-invalid={fieldNeedsReview(`items[${index}].name`)} onChange={(event) => updateItem(item.id, { name: event.target.value })} className={`min-h-10 w-full min-w-0 rounded-xl border px-3 text-sm font-bold outline-none transition focus:border-[#ed795d] focus:ring-2 focus:ring-[#ed795d]/10 ${fieldNeedsReview(`items[${index}].name`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <label><span className="sr-only">{t("scan.quantityAria", { name: item.name })}</span><input type="number" min="1" step="1" value={item.quantity} aria-invalid={fieldNeedsReview(`items[${index}].quantity`)} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className={`min-h-10 w-full rounded-xl border px-2 text-center text-sm outline-none transition focus:border-[#ed795d] focus:ring-2 focus:ring-[#ed795d]/10 ${fieldNeedsReview(`items[${index}].quantity`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <label><span className="sr-only">{t("scan.priceAria", { name: item.name })}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receiptCurrency] === 0 ? "1" : "0.01"} value={item.unitPrice} aria-invalid={fieldNeedsReview(`items[${index}].unit_price`)} onChange={(event) => updateItem(item.id, { unitPrice: Math.max(0, Number(event.target.value) || 0) })} className={`min-h-10 w-full rounded-xl border px-2 text-right text-sm font-bold outline-none transition focus:border-[#ed795d] focus:ring-2 focus:ring-[#ed795d]/10 ${fieldNeedsReview(`items[${index}].unit_price`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <button type="button" onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-xl text-lg text-[#b6b2a8] transition hover:bg-white hover:text-[#ed795d]" aria-label={t("scan.removeItemAria", { name: item.name })}>×</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4.25rem_5rem_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#aaa69c] sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]"><span /><span className="text-center">{t("scan.quantity")}</span><span className="text-right">{t("scan.each")}</span><span /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between rounded-2xl border border-[#eeeae2] bg-[#f7f6f1] px-4 py-3 text-sm text-[#77766d] transition focus-within:border-[#ed795d] focus-within:bg-white"><span>{t("scan.tax")}</span><span className="flex items-center gap-1 font-bold text-[#25251f]"><span>{receiptCurrency}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receiptCurrency] === 0 ? "1" : "0.01"} value={receipt.tax} aria-invalid={fieldNeedsReview("tax")} onChange={(event) => updateReceipt({ tax: Math.max(0, Number(event.target.value) || 0) })} className={`w-16 rounded px-1 text-right outline-none ${fieldNeedsReview("tax") ? "bg-[#fffaf0]" : "bg-transparent"}`} /></span></label>
              <label className="flex items-center justify-between rounded-2xl border border-[#eeeae2] bg-[#f7f6f1] px-4 py-3 text-sm text-[#77766d] transition focus-within:border-[#ed795d] focus-within:bg-white"><span>{t("scan.tip")}</span><span className="flex items-center gap-1 font-bold text-[#25251f]"><span>{receiptCurrency}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receiptCurrency] === 0 ? "1" : "0.01"} placeholder={t("scan.enter")} value={tipNeedsManualEntry ? "" : receipt.tip} aria-invalid={fieldNeedsReview("tip")} onChange={(event) => { setTipManuallyEdited(true); updateReceipt({ tip: event.target.value === "" ? 0 : Math.max(0, Number(event.target.value) || 0) }); }} className={`w-20 rounded px-1 text-right outline-none placeholder:text-[#aaa69c] ${fieldNeedsReview("tip") ? "bg-[#fffaf0]" : "bg-transparent"}`} /></span></label>
            </div>

            <div className={`rounded-[1.65rem] p-5 text-white shadow-[0_16px_34px_rgba(37,37,31,0.16)] ${fieldNeedsReview("total") ? "border-2 border-[#e6c66f] bg-[#302d24]" : "bg-[#25251f]"}`}>
              <label className="flex items-center justify-between gap-3 text-sm text-[#c7c4bb]"><span>{t("scan.subtotal")} · printed</span><span className="flex items-center gap-1"><span>{receiptCurrency}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receiptCurrency] === 0 ? "1" : "0.01"} value={receipt.subtotal} aria-label={`${t("scan.subtotal")} printed on receipt`} aria-invalid={Math.abs(receipt.subtotal - calculatedSubtotal) > 0.005} onChange={(event) => updateReceipt({ subtotal: Math.max(0, Number(event.target.value) || 0) })} className="w-24 rounded bg-transparent text-right outline-none focus:ring-2 focus:ring-white/50" /></span></label>
              <div className="mt-2 flex items-center justify-between text-xs text-[#c7c4bb]"><span>Items calculated from edited lines</span><span>{formatMoney(calculatedSubtotal, receiptCurrency)}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#c7c4bb]"><span>{t("scan.taxAndTip")}</span><span>{formatMoney(receipt.tax + receipt.tip, receiptCurrency)}</span></div>
              <div className="my-4 border-t border-white/15" />
              <label className="flex items-center justify-between gap-3"><span className="font-bold">{t("scan.chargedTotal")}</span><span className="flex items-center gap-1 text-2xl font-extrabold"><span>{receiptCurrency}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receiptCurrency] === 0 ? "1" : "0.01"} value={receipt.total} aria-label={t("scan.chargedTotal")} aria-invalid={fieldNeedsReview("total") || Math.abs(receipt.total - calculatedTotal) > 0.005} onChange={(event) => updateReceipt({ total: Math.max(0, Number(event.target.value) || 0) })} className="w-32 rounded bg-transparent text-right outline-none focus:ring-2 focus:ring-white/50" /></span></label>
              {parseMoneyToMinorUnits(String(receipt.total), receiptCurrency) !== null && <div className="mt-2 text-xs text-[#c7c4bb]"><CurrencyAmount amountMinor={parseMoneyToMinorUnits(String(receipt.total), receiptCurrency)!} originalCurrency={receiptCurrency} /></div>}
              {(Math.abs(receipt.total - calculatedTotal) > 0.005 || Math.abs(receipt.subtotal - calculatedSubtotal) > 0.005) && <p className="mt-3 text-xs leading-5 text-[#f4d578]">{t("scan.calculatedFromFields", { amount: formatMoney(calculatedTotal, receiptCurrency) })} Correct the extracted item, subtotal, tax, tip, or charged total before continuing. Splitzy will not adjust a price for you.</p>}
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-[#dfe5df] bg-[#f7f9f6] p-3 text-sm leading-5"><input type="checkbox" checked={receiptReviewed} onChange={(event) => setReceiptReviewed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#1e5a43]" /><span>I reviewed and corrected the extracted receipt details. I’ll select the payer and assign every item on the next screen.</span></label>
            {review?.needsConfirmation && <label className="flex items-start gap-3 rounded-xl border border-[#e6a095] bg-[#fff5f2] p-3 text-sm leading-5 text-[#8d4135]"><input type="checkbox" checked={transactionConfirmed} onChange={(event) => setTransactionConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a64531]" /><span>I confirmed these uploads belong to the same transaction.</span></label>}

            <button type="button" onClick={continueToExpenseForm} disabled={isLoading || isScanning} className="group min-h-14 w-full rounded-2xl bg-[#ed795d] px-6 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(237,121,93,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e86b4e] hover:shadow-[0_14px_28px_rgba(237,121,93,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed795d] disabled:cursor-wait disabled:opacity-60">{t("scan.continueToSplit")} <span aria-hidden="true" className="ml-1 inline-block transition group-hover:translate-x-1">→</span></button>
            <p className="text-center text-xs leading-5 text-[#a19e93]">{t("scan.nextAssignItems")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
