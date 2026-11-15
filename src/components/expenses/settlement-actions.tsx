"use client";

import { useMemo, useState } from "react";
import { Copy, Download, Mail, Printer, Share2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n";
import { formatMinorUnits } from "@/lib/currency/money";
import { createSettlementSummary, generateSettlementPdf, settlementEmailHref, settlementFileName, settlementSmsHref, type SettlementPdfLabels } from "@/lib/expenses/settlement-pdf";
import type { SettlementReport } from "@/lib/expenses/settlement-report";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettlementActions({ report }: { report: SettlementReport | null }) {
  const { locale, t } = useLanguage();
  const [shareOpen, setShareOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo<SettlementPdfLabels>(() => ({
    title: t("settlement.shareTitle"),
    subtitle: t("settlement.reportSubtitle"),
    generatedOn: t("settlement.generatedOn"),
    originalCurrency: t("settlement.originalCurrency"),
    totalExpenses: t("settlement.totalExpenses"),
    itemizedExpenses: t("settlement.itemizedExpenses"),
    memberShares: t("settlement.memberShares"),
    whoOwesWhom: t("settlement.whoOwesWhom"),
    outstandingTransfers: t("settlement.outstandingTransfers"),
    noOutstandingTransfers: t("settlement.noOutstandingTransfers"),
    paidBy: t("settlement.paidBy"),
    items: t("settlement.items"),
    subtotal: t("settlement.subtotal"),
    tax: t("settlement.tax"),
    tip: t("settlement.tip"),
    total: t("settlement.total"),
    paymentTracking: t("settlement.paymentTracking"),
  }), [t]);

  function clearFeedback() {
    setStatus(null);
    setError(null);
  }

  async function makePdf() {
    if (!report) throw new Error(t("settlement.noReport"));
    return generateSettlementPdf(report, labels, locale);
  }

  async function downloadPdf() {
    clearFeedback();
    setBusy(true);
    try {
      const blob = await makePdf();
      triggerDownload(blob, settlementFileName(report!));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settlement.actionError"));
    } finally {
      setBusy(false);
    }
  }

  function printReport() {
    clearFeedback();
    if (!report) { setError(t("settlement.noReport")); return; }
    window.print();
  }

  async function shareNative() {
    clearFeedback();
    if (!report) { setError(t("settlement.noReport")); return; }
    if (!navigator.share) { setError(t("settlement.attachPdf")); return; }
    setBusy(true);
    try {
      const summary = createSettlementSummary(report, labels, locale);
      const blob = await makePdf();
      const file = new File([blob], settlementFileName(report), { type: "application/pdf" });
      const canShareFile = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      await navigator.share({ title: `${labels.title}: ${report.groupName}`, text: summary, ...(canShareFile ? { files: [file] } : {}) });
      if (!canShareFile) setStatus(t("settlement.attachPdf"));
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : t("settlement.actionError"));
    } finally {
      setBusy(false);
    }
  }

  async function copySummary() {
    clearFeedback();
    if (!report) { setError(t("settlement.noReport")); return; }
    try {
      const summary = createSettlementSummary(report, labels, locale);
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(summary);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = summary;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        if (!document.execCommand("copy")) throw new Error(t("settlement.actionError"));
        textarea.remove();
      }
      setStatus(t("settlement.copied"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("settlement.actionError"));
    }
  }

  function openEmail() {
    clearFeedback();
    if (!report) { setError(t("settlement.noReport")); return; }
    window.location.href = settlementEmailHref(report, labels, locale);
  }

  function openSms() {
    clearFeedback();
    if (!report) { setError(t("settlement.noReport")); return; }
    window.location.href = settlementSmsHref(report, labels, locale);
  }

  return <div className="settlement-actions relative print:hidden">
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void downloadPdf()} disabled={!report || busy} title={t("settlement.downloadPdf")}><Download size={15} aria-hidden="true" /><span>{busy ? t("settlement.preparing") : t("settlement.downloadPdf")}</span></Button>
      <Button type="button" variant="outline" size="sm" onClick={printReport} disabled={!report || busy} title={t("settlement.print")}><Printer size={15} aria-hidden="true" /><span>{t("settlement.print")}</span></Button>
      <Button type="button" variant="primary" size="sm" onClick={() => { clearFeedback(); setShareOpen((open) => !open); }} disabled={!report || busy} aria-expanded={shareOpen} aria-haspopup="dialog"><Share2 size={15} aria-hidden="true" /><span>{t("settlement.share")}</span></Button>
    </div>

    {shareOpen && report && <div role="dialog" aria-label={t("settlement.shareTitle")} className="absolute right-0 top-full z-30 mt-2 w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-border bg-white p-3 shadow-[0_18px_50px_rgba(31,50,77,0.16)]">
      <div className="flex items-start justify-between gap-3 border-b border-border px-2 pb-3"><div><p className="text-sm font-extrabold text-foreground">{t("settlement.shareTitle")}</p><p className="mt-1 text-xs leading-5 text-muted">{t("settlement.paymentTracking")}</p></div><button type="button" onClick={() => setShareOpen(false)} aria-label={t("settlement.close")} className="rounded-lg px-2 py-1 text-lg leading-none text-muted hover:bg-surface-muted">×</button></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void shareNative()} disabled={busy}><Share2 size={15} aria-hidden="true" />{t("settlement.nativeShare")}</Button>
        <Button type="button" variant="outline" size="sm" onClick={openEmail}><Mail size={15} aria-hidden="true" />{t("settlement.email")}</Button>
        <Button type="button" variant="outline" size="sm" onClick={openSms}><Smartphone size={15} aria-hidden="true" />{t("settlement.sms")}</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => void copySummary()}><Copy size={15} aria-hidden="true" />{t("settlement.copySummary")}</Button>
      </div>
    </div>}

    {status && <p role="status" className="brand-alert brand-alert-success mt-2 text-xs">{status}</p>}
    {error && <p role="alert" className="brand-alert brand-alert-danger mt-2 max-w-xl text-xs">{error}</p>}
  </div>;
}

export function SettlementPrintReport({ report }: { report: SettlementReport | null }) {
  const { locale, t } = useLanguage();
  if (!report) return null;
  const localLocale = locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : locale;
  const money = (amountCents: number) => formatMinorUnits(amountCents, report.currency, localLocale);
  return <article className="settlement-print-report">
    <header className="settlement-print-header"><div><p className="settlement-print-brand">splitzy</p><p className="settlement-print-subtitle">{t("settlement.reportSubtitle")}</p></div><div className="settlement-print-meta"><p>{t("settlement.generatedOn")}: {new Intl.DateTimeFormat(localLocale, { dateStyle: "medium" }).format(new Date(report.generatedAt))}</p><p>{t("settlement.originalCurrency")}: {report.currency}</p></div></header>
    <h1>{report.groupName}</h1>
    <div className="settlement-print-summary"><div><span>{t("settlement.totalExpenses")}</span><strong>{money(report.totalExpensesCents)}</strong></div><div><span>{t("settlement.tax")}</span><strong>{money(report.totalTaxCents)}</strong></div><div><span>{t("settlement.tip")}</span><strong>{money(report.totalTipCents)}</strong></div></div>
    <section><h2>{t("settlement.itemizedExpenses")}</h2>{report.expenses.map((expense) => <div className="settlement-print-expense" key={expense.id}><div className="settlement-print-row settlement-print-expense-heading"><strong>{expense.description}</strong><strong>{money(expense.totalCents)}</strong></div><p>{t("settlement.paidBy")}: {expense.paidBy}</p>{expense.items.map((item) => <div className="settlement-print-row" key={item.name}><span>{item.quantity} × {item.name}</span><span>{money(item.totalCents)}</span></div>)}<div className="settlement-print-charge"><div className="settlement-print-row"><span>{t("settlement.subtotal")}</span><span>{money(expense.subtotalCents)}</span></div><div className="settlement-print-row"><span>{t("settlement.tax")}</span><span>{money(expense.taxCents)}</span></div><div className="settlement-print-row"><span>{t("settlement.tip")}</span><span>{money(expense.tipCents)}</span></div></div></div>)}</section>
    <section><h2>{t("settlement.memberShares")}</h2>{report.members.map((member) => <div className="settlement-print-row" key={member.id}><span>{member.name}</span><strong>{money(member.shareCents)}</strong></div>)}</section>
    <section><h2>{t("settlement.whoOwesWhom")}</h2>{report.transfers.length ? report.transfers.map((transfer) => <div className="settlement-print-row" key={`${transfer.from}-${transfer.to}`}><span>{transfer.from} → {transfer.to}</span><strong>{money(transfer.amountCents)}</strong></div>) : <p>{t("settlement.noOutstandingTransfers")}</p>}</section>
    <footer>{t("settlement.paymentTracking")}</footer>
  </article>;
}
