"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Copy, Send, Share2 } from "lucide-react";
import { formatCents, type Transfer } from "@/lib/expenses/calculations";
import { buildPaymentReminder, type ReminderLanguage, type ReminderTone } from "@/lib/expenses/payment-reminders";
import type { CurrencyCode } from "@/lib/currency/types";

export function PaymentReminderComposer({ groupName, transfer, currency = "USD", fromName, toName }: {
  groupName: string;
  transfer: Transfer;
  currency?: CurrencyCode;
  fromName: string;
  toName: string;
}) {
  const id = useId();
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [tone, setTone] = useState<ReminderTone>("friendly");
  const [language, setLanguage] = useState<ReminderLanguage>("en");
  const [message, setMessage] = useState(() => buildPaymentReminder({ groupName, transfer, fromName, toName, tone: "friendly", language: "en", currency }));
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setMessage(buildPaymentReminder({ groupName, transfer, fromName, toName, tone, language, currency }));
    setNotice("");
  }, [groupName, transfer.amountCents, fromName, toName, tone, language, currency]);

  function updateTemplate(nextTone: ReminderTone, nextLanguage: ReminderLanguage) {
    setTone(nextTone);
    setLanguage(nextLanguage);
    setMessage(buildPaymentReminder({ groupName, transfer, fromName, toName, tone: nextTone, language: nextLanguage, currency }));
    setNotice("");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Message copied. Choose where to send it.");
    } catch {
      messageRef.current?.focus();
      messageRef.current?.select();
      setNotice("Select and copy the highlighted message to share it.");
    }
  }

  async function shareMessage() {
    if (typeof navigator.share !== "function") {
      await copyMessage();
      return;
    }
    try {
      await navigator.share({ title: `Splitzy · ${groupName}`, text: message });
      setNotice("Share sheet closed. Check your chosen app to confirm delivery.");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") {
        setNotice("Sharing canceled.");
        return;
      }
      await copyMessage();
    }
  }

  return <div className="mt-4">
    <button type="button" aria-expanded={open} aria-controls={`${id}-composer`} onClick={() => { setOpen((value) => !value); setNotice(""); }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 sm:w-auto">
      <Send size={16} aria-hidden="true" />{open ? "Close payment request" : "Send Payment Request"}
    </button>
    {open && <div id={`${id}-composer`} className="mt-4 rounded-2xl border border-[#dfe7dc] bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-base font-bold text-foreground">Payment request</h3>
      <p className="mt-1 text-sm text-muted">Review the details and edit your message before sharing.</p>
      <dl className="mt-4 grid gap-3 rounded-xl bg-[#f7f9f6] p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs font-semibold text-muted">Request from</dt><dd className="mt-1 font-bold">{fromName}</dd></div>
        <div><dt className="text-xs font-semibold text-muted">Payment to</dt><dd className="mt-1 font-bold">{toName}</dd></div>
        <div><dt className="text-xs font-semibold text-muted">Group</dt><dd className="mt-1 font-medium">{groupName}</dd></div>
        <div><dt className="text-xs font-semibold text-muted">Amount · {currency}</dt><dd className="mt-1 font-bold">{formatCents(transfer.amountCents, currency)}</dd></div>
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-muted">Tone<select value={tone} onChange={(event) => updateTemplate(event.target.value as ReminderTone, language)} className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"><option value="friendly">Friendly</option><option value="polite">Polite</option><option value="direct">Direct</option><option value="funny">Funny</option></select></label>
        <label className="text-xs font-semibold text-muted">Language<select value={language} onChange={(event) => updateTemplate(tone, event.target.value as ReminderLanguage)} className="mt-1 h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10"><option value="en">English</option><option value="zh-TW">繁體中文</option></select></label>
      </div>
      <label htmlFor={`${id}-message`} className="mt-4 block text-xs font-semibold text-muted">Your message</label>
      <textarea ref={messageRef} id={`${id}-message`} value={message} onChange={(event) => { setMessage(event.target.value); setNotice(""); }} rows={4} maxLength={1000} className="mt-1 min-h-28 w-full resize-y rounded-lg border border-border bg-white p-3 text-base leading-6 text-foreground focus:border-primary focus:outline-none focus:ring-4 focus-visible:ring-primary/10 sm:text-sm" />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={!message.trim()} onClick={() => void shareMessage()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50"><Share2 size={16} aria-hidden="true" />Share Message</button>
        <button type="button" disabled={!message.trim()} onClick={() => void copyMessage()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:opacity-50"><Copy size={16} aria-hidden="true" />Copy Message</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">Choose a recipient in your messaging app. Splitzy does not send or track payments.</p>
      {notice && <p role="status" className="mt-2 text-sm font-medium text-primary">{notice}</p>}
    </div>}
  </div>;
}
