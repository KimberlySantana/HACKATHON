"use client";

import { useState } from "react";
import { buildPaymentReminder, type ReminderLanguage, type ReminderTone } from "@/lib/expenses/payment-reminders";
import type { Transfer } from "@/lib/expenses/calculations";

export function PaymentReminderComposer({ groupName, transfer, fromName, toName }: {
  groupName: string;
  transfer: Transfer;
  fromName: string;
  toName: string;
}) {
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ReminderTone>("friendly");
  const [language, setLanguage] = useState<ReminderLanguage>("en");
  const [message, setMessage] = useState(() => buildPaymentReminder({ groupName, transfer, fromName, toName, tone: "friendly", language: "en" }));
  const [notice, setNotice] = useState("");

  function updateTone(value: ReminderTone) {
    setTone(value);
    setMessage(buildPaymentReminder({ groupName, transfer, fromName, toName, tone: value, language }));
    setNotice("");
  }

  function updateLanguage(value: ReminderLanguage) {
    setLanguage(value);
    setMessage(buildPaymentReminder({ groupName, transfer, fromName, toName, tone, language: value }));
    setNotice("");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Reminder copied.");
      return true;
    } catch {
      setNotice("Copy isn’t available here. Select the message above and copy it.");
      return false;
    }
  }

  async function shareMessage() {
    if (typeof navigator.share !== "function") {
      const copied = await copyMessage();
      if (copied) setNotice("Sharing isn’t available here, so the reminder was copied instead.");
      return;
    }
    try {
      await navigator.share({ title: `Splitzy · ${groupName}`, text: message });
      setNotice("Share sheet opened.");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setNotice("The reminder couldn’t be shared. You can copy the message instead.");
    }
  }

  return <div className="mt-2">
    <button type="button" aria-expanded={open} onClick={() => { setOpen((value) => !value); setNotice(""); }} className="inline-flex min-h-10 items-center rounded-lg px-2 text-xs font-semibold text-primary hover:bg-[#f3f7f3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">
      {open ? "Close reminder" : "Write payment reminder"}
    </button>
    {open && <div className="mt-2 rounded-xl border border-[#e5e9e3] bg-white p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">Tone<select value={tone} onChange={(event) => updateTone(event.target.value as ReminderTone)} className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"><option value="friendly">Friendly</option><option value="polite">Polite</option><option value="direct">Direct</option><option value="funny">Funny</option></select></label>
        <label className="text-xs font-semibold text-muted">Language<select value={language} onChange={(event) => updateLanguage(event.target.value as ReminderLanguage)} className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"><option value="en">English</option><option value="zh-TW">繁體中文</option></select></label>
      </div>
      <label htmlFor={`reminder-${transfer.fromMemberId}-${transfer.toMemberId}`} className="mt-3 block text-xs font-semibold text-muted">Edit your message</label>
      <textarea id={`reminder-${transfer.fromMemberId}-${transfer.toMemberId}`} value={message} onChange={(event) => { setMessage(event.target.value); setNotice(""); }} rows={3} maxLength={1000} className="mt-1 min-h-24 w-full resize-y rounded-lg border border-border bg-[#fcfdfb] p-3 text-base leading-6 text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 sm:text-sm" />
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => void copyMessage()} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">Copy message</button>
        <button type="button" onClick={() => void shareMessage()} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20">Share</button>
      </div>
      {notice && <p role="status" className="mt-2 text-xs font-medium text-primary">{notice}</p>}
    </div>}
  </div>;
}
