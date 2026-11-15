import { formatMinorUnits } from "../currency/money.ts";
import type { CurrencyCode } from "../currency/types.ts";
import type { Locale } from "../i18n/translations.ts";
import type { SettlementReport } from "./settlement-report.ts";

export interface SettlementPdfLabels {
  title: string;
  subtitle: string;
  generatedOn: string;
  originalCurrency: string;
  totalExpenses: string;
  itemizedExpenses: string;
  memberShares: string;
  whoOwesWhom: string;
  outstandingTransfers: string;
  noOutstandingTransfers: string;
  paidBy: string;
  items: string;
  subtotal: string;
  tax: string;
  tip: string;
  total: string;
  paymentTracking: string;
}

const pageWidth = 1240;
const pageHeight = 1754;
const margin = 76;
const ink = "#1f2d42";
const muted = "#66758a";
const navy = "#314c70";
const coral = "#ed795d";
const cream = "#fffaf1";
const sage = "#e8f3ef";

function localeCode(locale: Locale) {
  return locale === "zh" ? "zh-CN" : locale === "ko" ? "ko-KR" : locale;
}

function money(amountCents: number, currency: CurrencyCode, locale: Locale) {
  return formatMinorUnits(amountCents, currency, localeCode(locale));
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const lines: string[] = [];
  let line = "";
  for (const character of Array.from(text)) {
    const next = line + character;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line.trim());
      line = character;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line.trim());
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length > 0) visible[visible.length - 1] = `${visible[visible.length - 1].slice(0, -1)}…`;
  visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
  return visible.length;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawHeader(ctx: CanvasRenderingContext2D, report: SettlementReport, labels: SettlementPdfLabels, locale: Locale) {
  ctx.fillStyle = navy;
  ctx.fillRect(0, 0, pageWidth, 190);
  ctx.fillStyle = coral;
  ctx.fillRect(0, 184, pageWidth, 6);

  ctx.fillStyle = "#ffffff";
  ctx.font = '800 34px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  ctx.fillText("splitzy", margin, 68);
  ctx.font = '600 15px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "#dfe8f5";
  ctx.fillText(labels.subtitle, margin, 98);

  ctx.font = '800 28px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "#ffffff";
  drawWrappedText(ctx, report.groupName, margin, 148, 720, 34, 1);
  ctx.textAlign = "right";
  ctx.font = '600 14px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  ctx.fillStyle = "#dfe8f5";
  ctx.fillText(`${labels.generatedOn}: ${new Intl.DateTimeFormat(localeCode(locale), { dateStyle: "medium" }).format(new Date(report.generatedAt))}`, pageWidth - margin, 68);
  ctx.fillText(`${labels.originalCurrency}: ${report.currency}`, pageWidth - margin, 96);
  ctx.textAlign = "left";
}

function drawSummaryCard(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, label: string, value: string, fill: string) {
  ctx.fillStyle = fill;
  roundedRect(ctx, x, y, width, 108, 18);
  ctx.fillStyle = muted;
  ctx.font = '700 14px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  ctx.fillText(label.toUpperCase(), x + 20, y + 30);
  ctx.fillStyle = ink;
  ctx.font = '800 26px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  drawWrappedText(ctx, value, x + 20, y + 73, width - 40, 30, 1);
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, y: number) {
  ctx.fillStyle = ink;
  ctx.font = '800 21px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  ctx.fillText(title, margin, y);
  ctx.fillStyle = coral;
  ctx.fillRect(margin, y + 12, 44, 4);
  return y + 44;
}

function drawPage(report: SettlementReport, labels: SettlementPdfLabels, locale: Locale, pageNumber: number, includeSummary: boolean, includeMemberSections: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = pageWidth;
  canvas.height = pageHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create a PDF canvas.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pageWidth, pageHeight);
  ctx.textBaseline = "alphabetic";
  drawHeader(ctx, report, labels, locale);

  let y = includeSummary ? 250 : 230;
  if (includeSummary) {
    const cardGap = 16;
    const cardWidth = (pageWidth - margin * 2 - cardGap * 2) / 3;
    drawSummaryCard(ctx, margin, y, cardWidth, labels.totalExpenses, money(report.totalExpensesCents, report.currency, locale), cream);
    drawSummaryCard(ctx, margin + cardWidth + cardGap, y, cardWidth, labels.tax, money(report.totalTaxCents, report.currency, locale), sage);
    drawSummaryCard(ctx, margin + (cardWidth + cardGap) * 2, y, cardWidth, labels.tip, money(report.totalTipCents, report.currency, locale), "#f3f0fb");
    y += 160;
  }

  y = drawSectionTitle(ctx, labels.itemizedExpenses, y);
  for (const expense of report.expenses) {
    if (y > pageHeight - 250) break;
    ctx.fillStyle = "#f7f9fc";
    roundedRect(ctx, margin, y, pageWidth - margin * 2, 48, 12);
    ctx.fillStyle = ink;
    ctx.font = '800 16px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
    drawWrappedText(ctx, expense.description, margin + 18, y + 21, 520, 20, 1);
    ctx.fillStyle = muted;
    ctx.font = '600 12px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
    ctx.fillText(`${labels.paidBy}: ${expense.paidBy}`, margin + 18, y + 39);
    ctx.textAlign = "right";
    ctx.fillStyle = ink;
    ctx.font = '800 16px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
    ctx.fillText(money(expense.totalCents, report.currency, locale), pageWidth - margin - 18, y + 29);
    ctx.textAlign = "left";
    y += 62;

    for (const item of expense.items) {
      if (y > pageHeight - 220) break;
      ctx.fillStyle = ink;
      ctx.font = '500 14px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
      drawWrappedText(ctx, `${item.quantity} × ${item.name}`, margin + 20, y, pageWidth - margin * 2 - 240, 18, 1);
      ctx.textAlign = "right";
      ctx.fillText(money(item.totalCents, report.currency, locale), pageWidth - margin - 20, y);
      ctx.textAlign = "left";
      y += 24;
    }

    ctx.strokeStyle = "#dfe6ee";
    ctx.beginPath();
    ctx.moveTo(margin + 20, y + 2);
    ctx.lineTo(pageWidth - margin - 20, y + 2);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '600 13px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
    const chargeRows = [[labels.subtotal, expense.subtotalCents], [labels.tax, expense.taxCents], [labels.tip, expense.tipCents]] as const;
    for (const [label, amount] of chargeRows) {
      y += 22;
      ctx.fillText(label, margin + 20, y);
      ctx.textAlign = "right";
      ctx.fillText(money(amount, report.currency, locale), pageWidth - margin - 20, y);
      ctx.textAlign = "left";
    }
    y += 30;
  }

  y = Math.max(y, includeSummary ? 400 : 290);
  if (includeMemberSections && y < pageHeight - 390) {
    y = drawSectionTitle(ctx, labels.memberShares, y);
    ctx.fillStyle = ink;
    ctx.font = '700 14px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
    for (const member of report.members) {
      ctx.fillText(member.name, margin + 18, y);
      ctx.textAlign = "right";
      ctx.fillText(money(member.shareCents, report.currency, locale), pageWidth - margin - 18, y);
      ctx.textAlign = "left";
      y += 28;
    }
    y += 18;
    y = drawSectionTitle(ctx, labels.whoOwesWhom, y);
    if (report.transfers.length === 0) {
      ctx.fillStyle = muted;
      ctx.font = '600 14px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
      ctx.fillText(labels.noOutstandingTransfers, margin + 18, y);
      y += 30;
    } else {
      for (const transfer of report.transfers) {
        ctx.fillStyle = ink;
        ctx.font = '600 14px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
        ctx.fillText(`${transfer.from} → ${transfer.to}`, margin + 18, y);
        ctx.textAlign = "right";
        ctx.fillText(money(transfer.amountCents, report.currency, locale), pageWidth - margin - 18, y);
        ctx.textAlign = "left";
        y += 28;
      }
    }
  }

  ctx.fillStyle = muted;
  ctx.font = '500 11px Inter, "Noto Sans SC", "Noto Sans KR", sans-serif';
  drawWrappedText(ctx, labels.paymentTracking, margin, pageHeight - 64, pageWidth - margin * 2 - 90, 16, 2);
  ctx.textAlign = "right";
  ctx.fillText(String(pageNumber), pageWidth - margin, pageHeight - 54);
  ctx.textAlign = "left";
  return canvas;
}

function dataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function ascii(value: string) {
  return new TextEncoder().encode(value);
}

function joinBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

function createPdf(images: Uint8Array[]) {
  const pageIds = images.map((_, index) => 3 + index * 3);
  const objects: Uint8Array[] = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${images.length} >>`),
  ];
  images.forEach((image, index) => {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    objects[pageId - 1] = ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects[imageId - 1] = joinBytes([ascii(`<< /Type /XObject /Subtype /Image /Width ${pageWidth} /Height ${pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, ascii("\nendstream")]);
    const content = "q 595.28 0 0 841.89 0 0 cm /Im0 Do Q\n";
    objects[contentId - 1] = ascii(`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`);
  });

  const parts: Uint8Array[] = [ascii("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n")];
  const offsets: number[] = [0];
  let position = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const prefix = ascii(`${index + 1} 0 obj\n`);
    const suffix = ascii("\nendobj\n");
    parts.push(prefix, object, suffix);
    position += prefix.length + object.length + suffix.length;
  });
  const xrefOffset = position;
  const xref = [`xref`, `0 ${objects.length + 1}`, `0000000000 65535 f `, ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `), `trailer`, `<< /Size ${objects.length + 1} /Root 1 0 R >>`, `startxref`, String(xrefOffset), `%%EOF`].join("\n") + "\n";
  parts.push(ascii(xref));
  return new Blob([joinBytes(parts)], { type: "application/pdf" });
}

export function settlementFileName(report: SettlementReport) {
  const safeGroup = report.groupName.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "group";
  return `splitzy-${safeGroup}-settlement.pdf`;
}

export function settlementPdfPageCount(report: SettlementReport) {
  const expensePages = Math.max(1, Math.ceil(report.expenses.length / 3));
  return expensePages + (report.expenses.length > 0 && report.expenses.length % 3 === 0 ? 1 : 0);
}

export function createSettlementSummary(report: SettlementReport, labels: SettlementPdfLabels, locale: Locale) {
  const lines = [
    `${labels.title}: ${report.groupName}`,
    `${labels.generatedOn}: ${new Intl.DateTimeFormat(localeCode(locale), { dateStyle: "medium" }).format(new Date(report.generatedAt))}`,
    `${labels.originalCurrency}: ${report.currency}`,
    `${labels.totalExpenses}: ${money(report.totalExpensesCents, report.currency, locale)}`,
    `${labels.tax}: ${money(report.totalTaxCents, report.currency, locale)} · ${labels.tip}: ${money(report.totalTipCents, report.currency, locale)}`,
    "",
    labels.memberShares,
    ...report.members.map((member) => `- ${member.name}: ${money(member.shareCents, report.currency, locale)}`),
    "",
    labels.whoOwesWhom,
    ...(report.transfers.length ? report.transfers.map((transfer) => `- ${transfer.from} → ${transfer.to}: ${money(transfer.amountCents, report.currency, locale)}`) : [labels.noOutstandingTransfers]),
  ];
  return lines.join("\n");
}

export function settlementEmailHref(report: SettlementReport, labels: SettlementPdfLabels, locale: Locale) {
  const summary = createSettlementSummary(report, labels, locale);
  return `mailto:?subject=${encodeURIComponent(`${labels.title}: ${report.groupName}`)}&body=${encodeURIComponent(summary)}`;
}

export function settlementSmsHref(report: SettlementReport, labels: SettlementPdfLabels, locale: Locale) {
  return `sms:?body=${encodeURIComponent(createSettlementSummary(report, labels, locale))}`;
}

export async function generateSettlementPdf(report: SettlementReport, labels: SettlementPdfLabels, locale: Locale) {
  const pages: HTMLCanvasElement[] = [];
  const chunkSize = 3;
  const expenseChunks = report.expenses.length === 0 ? [[]] : Array.from({ length: Math.ceil(report.expenses.length / chunkSize) }, (_, index) => report.expenses.slice(index * chunkSize, (index + 1) * chunkSize));
  expenseChunks.forEach((expenses, index) => {
    const isFirst = index === 0;
    const isLast = index === expenseChunks.length - 1;
    pages.push(drawPage({ ...report, expenses }, labels, locale, index + 1, isFirst, isLast));
  });
  if (report.expenses.length > 0 && report.expenses.length % chunkSize === 0) {
    pages.push(drawPage({ ...report, expenses: [] }, labels, locale, pages.length + 1, false, true));
  }
  const images = pages.map((page) => dataUrlBytes(page.toDataURL("image/jpeg", 0.92)));
  return createPdf(images);
}
