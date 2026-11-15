"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n";
import { useSavedGroups } from "@/components/groups/use-saved-groups";
import type { ReceiptReview, ReceiptScanResult } from "@/lib/receipt/extraction";
import { createReceiptTransfer, saveReceiptTransfer } from "@/lib/expenses/receipt-transfer";
import { validateReceiptForTransfer } from "@/lib/splitting/receipt";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { Receipt, ReceiptItem } from "@/types";
import { formatMajorUnits } from "@/lib/currency/money";
import { CURRENCY_CODES, CURRENCY_DECIMALS, CURRENCY_LABELS, type CurrencyCode } from "@/lib/currency/types";
import { CurrencyAmount } from "@/components/currency";
import { majorToMinorUnits } from "@/lib/currency/money";
import { calculatePercentageMinorUnits, parsePercentageToPpm } from "@/lib/finance/percentages";

type ReceiptRole = "itemized" | "payment";

type SelectedFile = {
  file: File;
  previewUrl: string;
};

type SelectedFiles = Record<ReceiptRole, SelectedFile | null>;

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;

function localizeServerError(message: string, t: Translator) {
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
  if (note.startsWith("The two receipts show different currencies")) return t("review.currencyConflict");
  if (note.startsWith("Receipt currency is missing")) return t("review.currencyMissing");
  if (note.startsWith("Receipt date is missing")) return t("review.dateMissing");
  if (note.startsWith("Date format could not")) return t("review.dateInvalid");
  if (note.startsWith("No itemized receipt was detected")) return t("review.noItemized");
  if (note.startsWith("Itemized subtotal is missing")) return t("review.itemMissing");
  if (note.startsWith("Itemized tax is missing")) return t("review.taxMissing");
  if (note.startsWith("Tax was calculated")) return t("review.taxCalculated");
  if (note.startsWith("Tax is included")) return t("review.taxIncluded");
  if (note.startsWith("The receipt indicates that tax was not charged")) return t("review.taxNotCharged");
  if (note.startsWith("A tax percentage was found")) return t("review.taxBasisMissing");
  if (note.startsWith("The itemized receipt has lower-confidence")) return t("review.itemizedLowConfidence");
  if (note.startsWith("No clearly itemized receipt")) return t("review.receiptMissing");
  if (note.startsWith("The payment receipt has a blank tip")) return t("review.tipBlank");
  if (note.startsWith("The payment receipt shows suggested")) return t("review.tipSuggested");
  if (note.startsWith("The payment receipt tip line is unclear")) return t("review.tipUnclear");
  if (note.startsWith("No confirmed actual tip")) return t("review.tipMissing");
  if (note.startsWith("No actual tip amount")) return t("review.tipNotPresent");
  if (note.startsWith("The two receipts show different tip")) return t("review.tipConflict");
  if (note.startsWith("Tip was calculated")) return t("review.tipPercentageCalculated");
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

export default function ScanWorkspace() {
  const { t } = useLanguage();
  const router = useRouter();
  const { groups, loading: groupsLoading } = useSavedGroups();
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ itemized: null, payment: null });
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [review, setReview] = useState<ReceiptReview | null>(null);
  const [isDragging, setIsDragging] = useState<ReceiptRole | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [taxManuallyEdited, setTaxManuallyEdited] = useState(false);
  const [tipManuallyEdited, setTipManuallyEdited] = useState(false);
  const [includeTax, setIncludeTax] = useState(true);
  const [includeTip, setIncludeTip] = useState(true);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [isSendingToGroup, setIsSendingToGroup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scanRequestId = useRef(0);
  const groupHandoffApplied = useRef(false);

  const receiptSlots: Array<{ role: ReceiptRole; label: string; description: string }> = [
    { role: "itemized", label: t("scan.itemizedReceipt"), description: t("scan.itemizedDescription") },
    { role: "payment", label: t("scan.paymentReceipt"), description: t("scan.paymentDescription") },
  ];

  useEffect(() => {
    if (groupHandoffApplied.current || groupsLoading) return;
    groupHandoffApplied.current = true;
    const handoffGroupId = new URLSearchParams(window.location.search).get("groupId");
    if (handoffGroupId && groups.some(({ group }) => group.id === handoffGroupId)) setSelectedGroupId(handoffGroupId);
  }, [groups, groupsLoading]);

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

  const originalCalculatedTotal = useMemo(
    () => calculatedSubtotal + (receipt?.tax ?? 0) + (receipt?.tip ?? 0),
    [calculatedSubtotal, receipt?.tax, receipt?.tip],
  );

  const splitCalculatedTotal = useMemo(
    () => calculatedSubtotal + (includeTax ? receipt?.tax ?? 0 : 0) + (includeTip ? receipt?.tip ?? 0 : 0),
    [calculatedSubtotal, includeTax, includeTip, receipt?.tax, receipt?.tip],
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
    setTaxManuallyEdited(false);
    setTipManuallyEdited(false);
    setIncludeTax(true);
    setIncludeTip(true);
    setReviewAcknowledged(false);
    setError(null);
    setNotice(t("scan.readingReceipts", { receipts: uploads.length === 2 ? t("scan.bothReceipts") : t("scan.yourReceipt") }));

    try {
      const formData = new FormData();
      if (files.itemized) formData.append("itemizedFile", files.itemized.file);
      if (files.payment) formData.append("paymentFile", files.payment.file);

      const response = await fetch("/api/receipt/scan", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as Partial<ReceiptScanResult> & { error?: string };
      if (!response.ok) throw new Error(localizeServerError(payload.error || t("error.recognitionFailed"), t));
      if (!payload.receipt || !payload.review) throw new Error(t("error.incompleteResponse"));
      if (requestId !== scanRequestId.current) return;

      setReceipt(payload.receipt);
      setReview(payload.review);
      setTaxManuallyEdited(false);
      setTipManuallyEdited(false);
      setIncludeTax(!payload.review.fields.some((field) => field === "tax" || field.startsWith("tax.")));
      setIncludeTip(!payload.review.fields.some((field) => field === "tip" || field.startsWith("tip.")));
      setReviewAcknowledged(false);
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
      setError(scanError instanceof Error ? scanError.message : t("error.tryAgain"));
      setNotice(null);
    } finally {
      if (requestId === scanRequestId.current) setIsScanning(false);
    }
  }

  function handleFile(role: ReceiptRole, file: File) {
    if (!file.type.startsWith("image/")) {
      setError(t("error.invalidImage"));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(t("error.tooLargeImage"));
      return;
    }

    const selectedFile = { file, previewUrl: URL.createObjectURL(file) };
    const nextFiles = { ...selectedFiles, [role]: selectedFile };
    setSelectedFiles(nextFiles);
    setReceipt(null);
    setReview(null);
    setError(null);
      setReviewAcknowledged(false);
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
      setReviewAcknowledged(false);
    if (nextFiles.itemized || nextFiles.payment) {
      void scanReceipts(nextFiles);
    } else {
      scanRequestId.current += 1;
      setIsScanning(false);
      setNotice(null);
    }
  }

  async function loadSampleReceipt() {
    scanRequestId.current += 1;
    setIsScanning(false);
    setSelectedFiles({ itemized: null, payment: null });
    setIsLoading(true);
    setError(null);
    setReview(null);
    setTaxManuallyEdited(false);
    setTipManuallyEdited(false);
    setIncludeTax(true);
    setIncludeTip(true);
    setReviewAcknowledged(false);

    try {
      const response = await fetch("/api/receipt");
      if (!response.ok) throw new Error(t("error.demoLoad"));
      const sample = (await response.json()) as Receipt;
      setReceipt(sample);
      setReview(null);
      setTaxManuallyEdited(false);
      setTipManuallyEdited(false);
      setIncludeTax(true);
      setIncludeTip(true);
      setReviewAcknowledged(false);
      setNotice(t("scan.noticeDemoLoaded"));
    } catch {
      setError(t("error.demoLoadTryAgain"));
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

  function majorFromMinor(amountMinor: number, currency: CurrencyCode) {
    return Number((amountMinor / 10 ** CURRENCY_DECIMALS[currency]).toFixed(CURRENCY_DECIMALS[currency]));
  }

  function applySuggestedTipPercentage(percentage: number) {
    if (!receipt || !receipt.currency) return;
    const basisMajor = receipt.tipBasis === "post_tax_subtotal" ? receipt.subtotal + receipt.tax : receipt.subtotal;
    const basisMinor = majorToMinorUnits(basisMajor, receipt.currency);
    const ppm = parsePercentageToPpm(String(percentage));
    if (ppm === null) return;
    const tipMinor = calculatePercentageMinorUnits(basisMinor, ppm);
    setTipManuallyEdited(true);
    updateReceipt({ tip: majorFromMinor(tipMinor, receipt.currency), tipPercentage: percentage, tipInferred: false });
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
  }

  return (
    <div className="relative mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
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
                  <label
                    htmlFor={`${slot.role}-receipt-upload`}
                    onDragEnter={() => setIsDragging(slot.role)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDragging(null)}
                    onDrop={(event) => handleDrop(slot.role, event)}
                    className={`group relative flex min-h-52 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[1.65rem] border-2 border-dashed px-4 text-center transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(76,67,51,0.08)] focus-within:ring-4 focus-within:ring-[#ed795d]/10 ${isDragging === slot.role ? "border-[#ed795d] bg-[#fff5f1] shadow-[0_14px_30px_rgba(237,121,93,0.12)]" : "border-[#dedbd1] bg-[#fbfaf7] hover:border-[#ed795d] hover:bg-[#fffaf7]"}`}
                  >
                    <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#f7d7c9]/40 transition duration-300 group-hover:scale-125" aria-hidden="true" />
                    {selectedFile ? <img src={selectedFile.previewUrl} alt={`${slot.label} preview`} className="relative h-16 w-16 rounded-2xl object-cover shadow-[0_8px_18px_rgba(76,67,51,0.14)]" /> : <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-white text-xl text-[#ed795d] shadow-[0_8px_18px_rgba(76,67,51,0.08)] transition duration-300 group-hover:rotate-3 group-hover:scale-105" aria-hidden="true">↑</span>}
                    <span className="relative mt-4 text-sm font-extrabold tracking-[-0.01em]">{slot.label}</span>
                    <span className="relative mt-1 text-xs leading-5 text-[#929087]">{selectedFile ? `${(selectedFile.file.size / 1024 / 1024).toFixed(1)} MB · ${isScanning ? t("scan.analyzingReceipts") : t("scan.readyToReview")}` : slot.description}</span>
                    {!selectedFile && <span className="relative mt-3 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#a19e93] shadow-sm transition group-hover:text-[#ed795d]">{t("scan.chooseImage")}</span>}
                    <input id={`${slot.role}-receipt-upload`} type="file" accept="image/*" onChange={(event) => handleFileChange(slot.role, event)} className="sr-only" />
                  </label>
                  {selectedFile && <button type="button" onClick={() => removeFile(slot.role)} className="mt-2 w-full rounded-xl py-1.5 text-xs font-bold text-[#99968d] transition hover:bg-[#fff5f1] hover:text-[#ed795d]">{t("scan.remove", { label: slot.label })}</button>}
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-[#929087]">{t("scan.uploadDescription")}</p>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#eeeae2]" />
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#b0ada4]">{t("scan.or")}</span>
            <div className="h-px flex-1 bg-[#eeeae2]" />
          </div>

          <button type="button" onClick={loadSampleReceipt} disabled={isLoading || isScanning} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#e7e3da] bg-white px-4 text-sm font-extrabold transition duration-200 hover:-translate-y-0.5 hover:border-[#ed795d] hover:bg-[#fffaf7] hover:shadow-[0_10px_22px_rgba(76,67,51,0.07)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed795d] disabled:cursor-wait disabled:opacity-60">
            {isLoading ? t("scan.loadingDemo") : isScanning ? t("scan.analyzingReceipts") : t("scan.trySample")}
            {!isLoading && !isScanning && <span aria-hidden="true">↗</span>}
          </button>

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
                <select value={receipt.currency ?? ""} aria-invalid={fieldNeedsReview("currency")} onChange={(event) => updateReceipt({ currency: event.target.value ? event.target.value as CurrencyCode : null })} className={`mt-2 min-h-12 w-full rounded-2xl border px-4 text-sm font-bold outline-none transition focus:border-[#ed795d] focus:bg-white focus:ring-4 focus:ring-[#ed795d]/10 ${fieldNeedsReview("currency") ? "border-[#e6c66f] bg-[#fffaf0]" : "border-[#e7e3da] bg-[#fbfaf7]"}`}>
                  <option value="">{t("currency.original")}</option>
                  {CURRENCY_CODES.map((code) => <option key={code} value={code}>{CURRENCY_LABELS[code]}</option>)}
                </select>
              </label>
            </div>

            <div className="rounded-3xl border border-[#eeeae2] bg-[#fbfaf7] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between"><div><h3 className="text-sm font-extrabold">{t("scan.items")}</h3><p className="mt-1 text-xs text-[#aaa69c]">{t("scan.editMissed")}</p></div><button type="button" onClick={addItem} className="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-[#ed795d] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fff5f1] hover:text-[#d95f45]">{t("scan.addItem")}</button></div>
              <div className="space-y-3">
                {receipt.items.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_4.25rem_5rem_auto] items-center gap-2 border-b border-[#eae7df] pb-3 transition last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]">
                    <label className="min-w-0"><span className="sr-only">{t("scan.itemNameAria")}</span><input value={item.name} aria-invalid={fieldNeedsReview(`items[${index}].name`)} onChange={(event) => updateItem(item.id, { name: event.target.value })} className={`min-h-10 w-full min-w-0 rounded-xl border px-3 text-sm font-bold outline-none transition focus:border-[#ed795d] focus:ring-2 focus:ring-[#ed795d]/10 ${fieldNeedsReview(`items[${index}].name`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <label><span className="sr-only">{t("scan.quantityAria", { name: item.name })}</span><input type="number" min="1" step="1" value={item.quantity} aria-invalid={fieldNeedsReview(`items[${index}].quantity`)} onChange={(event) => updateItem(item.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} className={`min-h-10 w-full rounded-xl border px-2 text-center text-sm outline-none transition focus:border-[#ed795d] focus:ring-2 focus:ring-[#ed795d]/10 ${fieldNeedsReview(`items[${index}].quantity`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <label><span className="sr-only">{t("scan.priceAria", { name: item.name })}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receipt.currency ?? "USD"] === 0 ? "1" : "0.01"} value={item.unitPrice} aria-invalid={fieldNeedsReview(`items[${index}].unit_price`)} onChange={(event) => updateItem(item.id, { unitPrice: Math.max(0, Number(event.target.value) || 0) })} className={`min-h-10 w-full rounded-xl border px-2 text-right text-sm font-bold outline-none transition focus:border-[#ed795d] focus:ring-2 focus:ring-[#ed795d]/10 ${fieldNeedsReview(`items[${index}].unit_price`) ? "border-[#e6c66f] bg-[#fffaf0]" : "border-transparent bg-white"}`} /></label>
                    <button type="button" onClick={() => removeItem(item.id)} className="grid h-9 w-9 place-items-center rounded-xl text-lg text-[#b6b2a8] transition hover:bg-white hover:text-[#ed795d]" aria-label={t("scan.removeItemAria", { name: item.name })}>×</button>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4.25rem_5rem_auto] gap-2 px-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#aaa69c] sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]"><span /><span className="text-center">{t("scan.quantity")}</span><span className="text-right">{t("scan.each")}</span><span /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={`rounded-2xl border border-[#eeeae2] bg-[#f7f6f1] px-4 py-3 text-sm text-[#77766d] transition focus-within:border-[#ed795d] focus-within:bg-white ${fieldNeedsReview("tax") ? "border-[#e6c66f] bg-[#fffaf0]" : ""}`}>
                <label className="flex items-center justify-between gap-3"><span>{t("scan.tax")}{receipt.taxPercentage !== null && receipt.taxPercentage !== undefined ? <span className="ml-1 text-xs text-[#aaa69c]">({receipt.taxPercentage}%)</span> : null}</span><span className="flex items-center gap-1 font-bold text-[#25251f]"><span>{receipt.currency ?? "?"}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receipt.currency ?? "USD"] === 0 ? "1" : "0.01"} value={receipt.tax} aria-invalid={fieldNeedsReview("tax")} onChange={(event) => { setTaxManuallyEdited(true); setIncludeTax(true); updateReceipt({ tax: Math.max(0, Number(event.target.value) || 0), taxPercentage: null, taxInferred: false }); }} className="w-16 rounded px-1 text-right outline-none" /></span></label>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#77766d]"><input type="checkbox" checked={includeTax} onChange={(event) => setIncludeTax(event.target.checked)} className="mt-0.5 accent-[#ed795d]" />{t("scan.includeTax")}</label>
                {receipt.taxStatus === "included" && <p className="mt-2 text-xs leading-5 text-[#8a6d2f]">{t("scan.taxIncluded")}</p>}
              </div>
              <div className={`rounded-2xl border border-[#eeeae2] bg-[#f7f6f1] px-4 py-3 text-sm text-[#77766d] transition focus-within:border-[#ed795d] focus-within:bg-white ${fieldNeedsReview("tip") ? "border-[#e6c66f] bg-[#fffaf0]" : ""}`}>
                <label className="flex items-center justify-between gap-3"><span>{t("scan.tip")}{receipt.tipPercentage !== null && receipt.tipPercentage !== undefined ? <span className="ml-1 text-xs text-[#aaa69c]">({receipt.tipPercentage}%)</span> : null}</span><span className="flex items-center gap-1 font-bold text-[#25251f]"><span>{receipt.currency ?? "?"}</span><input type="number" min="0" step={CURRENCY_DECIMALS[receipt.currency ?? "USD"] === 0 ? "1" : "0.01"} placeholder={t("scan.enter")} value={tipNeedsManualEntry ? "" : receipt.tip} aria-invalid={fieldNeedsReview("tip")} onChange={(event) => { setTipManuallyEdited(event.target.value.trim() !== ""); setIncludeTip(true); updateReceipt({ tip: event.target.value === "" ? 0 : Math.max(0, Number(event.target.value) || 0), tipPercentage: null, tipInferred: false }); }} className="w-20 rounded px-1 text-right outline-none placeholder:text-[#aaa69c]" /></span></label>
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs leading-5 text-[#77766d]"><input type="checkbox" checked={includeTip} onChange={(event) => setIncludeTip(event.target.checked)} className="mt-0.5 accent-[#ed795d]" />{t("scan.includeTip")}</label>
                {(receipt.suggestedTipPercentages?.length ?? 0) > 0 && <fieldset className="mt-3"><legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#aaa69c]">{t("scan.suggestedTips")}</legend><div className="flex flex-wrap gap-2">{receipt.suggestedTipPercentages?.map((percentage) => <button key={percentage} type="button" onClick={() => applySuggestedTipPercentage(percentage)} aria-label={`${t("scan.chooseTip")}: ${percentage}%`} className="min-h-8 rounded-full border border-[#ead8ce] bg-white px-3 text-xs font-extrabold text-[#a45c4b] transition hover:-translate-y-0.5 hover:border-[#ed795d] hover:bg-[#fff5f1]">{percentage}%</button>)}</div></fieldset>}
              </div>
            </div>

            <div className={`rounded-[1.65rem] p-5 text-white shadow-[0_16px_34px_rgba(37,37,31,0.16)] ${fieldNeedsReview("total") ? "border-2 border-[#e6c66f] bg-[#302d24]" : "bg-[#25251f]"}`}>
              <div className="flex items-center justify-between text-sm text-[#c7c4bb]"><span>{t("scan.subtotal")}</span><span>{formatMajorUnits(calculatedSubtotal, receipt.currency ?? "USD")}</span></div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#c7c4bb]"><span>{t("scan.taxAndTip")}</span><span>{formatMajorUnits((includeTax ? receipt.tax : 0) + (includeTip ? receipt.tip : 0), receipt.currency ?? "USD")}</span></div>
              <div className="my-4 border-t border-white/15" />
              <div className="flex items-end justify-between"><span className="font-bold">{t("scan.splitTotal")}</span><strong className="text-right text-3xl font-extrabold tracking-tight">{formatMajorUnits(splitCalculatedTotal, receipt.currency ?? "USD")}</strong></div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#c7c4bb]"><span>{t("scan.originalReceiptTotal")}</span><CurrencyAmount amountMinor={majorToMinorUnits(receipt.total, receipt.currency ?? "USD")} originalCurrency={receipt.currency ?? "USD"} /></div>
              {Math.abs(receipt.total - originalCalculatedTotal) > 0.05 && <p className="mt-3 text-xs leading-5 text-[#f4d578]">{t("scan.calculatedFromFields", { amount: formatMajorUnits(originalCalculatedTotal, receipt.currency ?? "USD") })}</p>}
              {(!includeTax || !includeTip) && <p className="mt-3 text-xs leading-5 text-[#f4d578]">{t("scan.excludedChargesNote")}</p>}
            </div>

            {(review?.needsReview || review?.needsConfirmation) && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e6c66f] bg-[#fffaf0] px-4 py-3 text-sm leading-6 text-[#77684d]">
              <input type="checkbox" checked={reviewAcknowledged} onChange={(event) => setReviewAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-[#ed795d]" />
              <span>{t("scan.reviewAcknowledgement")}</span>
            </label>}

            <div className="rounded-[1.65rem] border border-[#f2d4c8] bg-[#fffaf7] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">{t("scan.chooseGroup")}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#929087]">{t("scan.chooseGroupDescription")}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#ed795d]">{t("scan.reviewBeforeTransfer")}</span>
              </div>
              {groups.length > 0 ? <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)} disabled={groupsLoading || isSendingToGroup} className="mt-4 min-h-12 w-full rounded-2xl border border-[#e7e3da] bg-white px-4 text-sm font-bold text-[#25251f] outline-none transition focus:border-[#ed795d] focus:ring-4 focus:ring-[#ed795d]/10 disabled:opacity-60">
                <option value="">{t("scan.chooseGroup")}</option>
                {groups.map(({ group }) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select> : <div className="mt-4 rounded-2xl border border-dashed border-[#e7e3da] bg-white px-4 py-3 text-sm leading-6 text-[#77766d]">{t("scan.noGroupsForTransfer")} <Link href="/groups" className="font-extrabold text-[#ed795d] hover:underline">{t("scan.createGroupFirst")}</Link></div>}
            </div>

            <button type="button" disabled={isSendingToGroup || isScanning || !selectedGroupId} onClick={() => {
              if (!receipt) return;
              setError(null);
              const receiptReview: ReceiptReview = review ?? { needsReview: false, needsConfirmation: false, confidence: "high", fields: [], notes: [] };
              const taxConfirmed = !includeTax || taxManuallyEdited || !fieldNeedsReview("tax") || Boolean(receipt.taxInferred && reviewAcknowledged);
              const tipConfirmed = !includeTip || tipManuallyEdited || !fieldNeedsReview("tip") || Boolean(receipt.tipInferred && reviewAcknowledged);
              const validation = validateReceiptForTransfer(receipt, receiptReview, tipConfirmed, reviewAcknowledged, [], { includeTax, includeTip, taxConfirmed });
              if (!validation.valid) {
                const key = validation.flags.includes("tip") ? "scan.transferTipError" : validation.flags.includes("tax") ? "scan.transferChargeError" : validation.flags.includes("review") ? "scan.transferReviewError" : validation.flags.includes("subtotal") || validation.flags.includes("total") ? "scan.transferTotalsError" : "scan.transferDataError";
                setError(t(key));
                return;
              }
              setIsSendingToGroup(true);
              try {
                saveReceiptTransfer(createReceiptTransfer(selectedGroupId, receipt, receiptReview, { includeTax, includeTip, taxConfirmed, tipConfirmed, reviewAcknowledged }));
                router.push(`/groups/${encodeURIComponent(selectedGroupId)}/expenses/new?fromReceipt=${encodeURIComponent(receipt.id)}`);
              } catch {
                setIsSendingToGroup(false);
                setError(t("scan.transferDataError"));
              }
            }} className="group min-h-14 w-full rounded-2xl bg-[#ed795d] px-6 text-base font-extrabold text-white shadow-[0_10px_24px_rgba(237,121,93,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e86b4e] hover:shadow-[0_14px_28px_rgba(237,121,93,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed795d] disabled:cursor-not-allowed disabled:opacity-50">{isSendingToGroup ? t("scan.sendingToGroup") : t("scan.continueToSplit")} <span aria-hidden="true" className="ml-1 inline-block transition group-hover:translate-x-1">→</span></button>
            <p className="text-center text-xs leading-5 text-[#a19e93]">{t("scan.nextAssignItems")}</p>
          </div>
        )}
      </section>
    </div>
  );
}
