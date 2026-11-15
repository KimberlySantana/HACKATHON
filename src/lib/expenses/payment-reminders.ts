import { formatCents, type Transfer } from "./calculations.ts";
import type { CurrencyCode } from "../currency/types.ts";

export type ReminderTone = "friendly" | "polite" | "direct" | "funny";
export type ReminderLanguage = "en" | "zh-TW";

const toneLabels: Record<ReminderTone, string> = {
  friendly: "Friendly",
  polite: "Polite",
  direct: "Direct",
  funny: "Funny",
};

export function getReminderToneLabel(tone: ReminderTone) {
  return toneLabels[tone];
}

/** Builds an editable reminder from one calculated settlement transfer. */
export function buildPaymentReminder({
  groupName,
  transfer,
  fromName,
  toName,
  tone,
  language,
  currency = "USD",
}: {
  groupName: string;
  transfer: Transfer;
  fromName: string;
  toName: string;
  tone: ReminderTone;
  language: ReminderLanguage;
  currency?: CurrencyCode;
}) {
  const amount = formatCents(transfer.amountCents, currency);
  if (language === "zh-TW") {
    const messages: Record<ReminderTone, string> = {
      friendly: `嗨 ${fromName}！有空時可以請你把 ${amount} 轉給 ${toName} 嗎？這是「${groupName}」的分攤款，謝謝你！`,
      polite: `${fromName} 您好，方便時請您將「${groupName}」的分攤款 ${amount} 轉給 ${toName}，謝謝。`,
      direct: `${fromName}，請將「${groupName}」的 ${amount} 轉給 ${toName}，謝謝。`,
      funny: `溫馨小提醒：${fromName}，請把「${groupName}」的 ${amount} 轉給 ${toName}。記帳小精靈正在友善地等待！`,
    };
    return messages[tone];
  }

  const messages: Record<ReminderTone, string> = {
    friendly: `Hi ${fromName}! When you get a chance, could you send ${toName} ${amount} for ${groupName}? Thanks so much!`,
    polite: `Hello ${fromName}, would you please send ${toName} ${amount} for ${groupName} when convenient? Thank you.`,
    direct: `Hi ${fromName}, please send ${toName} ${amount} for ${groupName}. Thank you.`,
    funny: `Tiny money nudge: ${fromName}, please send ${toName} ${amount} for ${groupName}—the spreadsheet gremlins are waiting (kindly).`,
  };
  return messages[tone];
}
