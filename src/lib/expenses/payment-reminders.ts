import { formatCents, type Transfer } from "./calculations.ts";

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
}: {
  groupName: string;
  transfer: Transfer;
  fromName: string;
  toName: string;
  tone: ReminderTone;
  language: ReminderLanguage;
}) {
  const amount = formatCents(transfer.amountCents);
  if (language === "zh-TW") {
    const messages: Record<ReminderTone, string> = {
      friendly: `嗨 ${toName}！有空時可以請你把 ${amount} 轉給 ${fromName} 嗎？這是「${groupName}」的分攤款，謝謝你！`,
      polite: `${toName} 您好，方便時請您將「${groupName}」的分攤款 ${amount} 轉給 ${fromName}，謝謝。`,
      direct: `${toName}，請將「${groupName}」的 ${amount} 轉給 ${fromName}，謝謝。`,
      funny: `溫馨小提醒：${toName}，請把「${groupName}」的 ${amount} 轉給 ${fromName}。記帳小精靈正在友善地等待！`,
    };
    return messages[tone];
  }

  const messages: Record<ReminderTone, string> = {
    friendly: `Hi ${toName}! When you get a chance, could you send ${fromName} ${amount} for ${groupName}? Thanks so much!`,
    polite: `Hello ${toName}, would you please send ${fromName} ${amount} for ${groupName} when convenient? Thank you.`,
    direct: `Hi ${toName}, please send ${fromName} ${amount} for ${groupName}. Thank you.`,
    funny: `Tiny money nudge: ${toName}, please send ${fromName} ${amount} for ${groupName}—the spreadsheet gremlins are waiting (kindly).`,
  };
  return messages[tone];
}
