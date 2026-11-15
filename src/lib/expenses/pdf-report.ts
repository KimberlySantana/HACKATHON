import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { calculateItemSharesCents, formatCents, getExpenseSubtotalCents, type SettlementMember, type Transfer } from "./calculations.ts";
import type { ExpenseRecord } from "./types.ts";
import type { CurrencyCode } from "../currency/types.ts";

type ReportGroup = { name: string; members: SettlementMember[] };
type BalanceMap = Map<string, number>;

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const COLORS = {
  brand: rgb(0.16, 0.31, 0.22),
  ink: rgb(0.14, 0.20, 0.18),
  muted: rgb(0.40, 0.45, 0.42),
  green: rgb(0.09, 0.52, 0.36),
  greenPale: rgb(0.92, 0.96, 0.93),
  owe: rgb(0.75, 0.34, 0.13),
  owePale: rgb(0.99, 0.95, 0.92),
  paper: rgb(1, 1, 1),
  light: rgb(0.96, 0.97, 0.96),
  line: rgb(0.87, 0.90, 0.88),
};

let cachedFontBytes: Promise<Uint8Array> | undefined;

async function loadFontBytes() {
  cachedFontBytes ??= fetch("/fonts/NotoSansTC-Traditional.ttf").then(async (response) => {
    if (!response.ok) throw new Error("The report font could not be loaded.");
    return new Uint8Array(await response.arrayBuffer());
  });
  return cachedFontBytes;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const paragraphs = text.replace(/\r/g, "").split("\n");
  const result: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/(\s+)/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line + word;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line.trim()) result.push(line.trimEnd());
      line = "";
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        line = word.trimStart();
        continue;
      }
      for (const char of Array.from(word)) {
        if (line && font.widthOfTextAtSize(line + char, fontSize) > maxWidth) {
          result.push(line);
          line = "";
        }
        line += char;
      }
    }
    if (line.trim() || paragraph === "") result.push(line.trimEnd());
  }
  return result.length ? result : [""];
}

function fitSize(text: string, font: PDFFont, size: number, maxWidth: number, minSize = 7) {
  let fitted = size;
  while (fitted > minSize && font.widthOfTextAtSize(text, fitted) > maxWidth) fitted -= 0.5;
  return fitted;
}

function drawFit(page: PDFPage, text: string, font: PDFFont, options: {
  x: number; y: number; size: number; maxWidth: number; color?: typeof COLORS.ink; minSize?: number;
}) {
  const size = fitSize(text, font, options.size, options.maxWidth, options.minSize);
  page.drawText(text, { x: options.x, y: options.y, size, font, color: options.color ?? COLORS.ink });
}

function formatReportDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatExpenseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** Builds a paginated, Unicode-enabled PDF using only the provided saved records and calculated transfers. */
export async function createSettlementPdf({
  group,
  expenses,
  transfers,
  balances,
  generatedAt = new Date(),
  dataSource,
  currency,
  fontBytes,
}: {
  group: ReportGroup;
  expenses: ExpenseRecord[];
  transfers: Transfer[];
  balances: BalanceMap;
  generatedAt?: Date;
  dataSource: "Cloud-saved records" | "Guest records on this device";
  currency?: CurrencyCode;
  /** Optional font bytes for deterministic local tests. Normal browser use fetches the bundled font. */
  fontBytes?: Uint8Array;
}): Promise<Uint8Array> {
  const reportCurrency = currency ?? expenses[0]?.currency ?? "USD";
  if (new Set(expenses.map((expense) => expense.currency ?? "USD")).size > 1) throw new Error("A PDF report cannot combine expenses in different currencies.");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const embeddedFont = await pdf.embedFont(fontBytes ?? await loadFontBytes(), { subset: true });
  const names = new Map(group.members.map((member) => [member.id, member.name]));
  const totalExpensesCents = expenses.reduce((sum, expense) => sum + getExpenseSubtotalCents(expense) + expense.taxCents + expense.tipCents, 0);
  if (!Number.isSafeInteger(totalExpensesCents)) throw new Error("Report total exceeds the supported range.");

  const pages: PDFPage[] = [];
  let page = null as unknown as PDFPage;
  let y = 0;

  function drawBrandHeader(title: string, first = false) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    if (first) {
      page.drawRectangle({ x: 0, y: 670, width: PAGE_WIDTH, height: 122, color: COLORS.brand });
      page.drawText("SPLITZY", { x: MARGIN, y: 762, size: 9, font: embeddedFont, color: COLORS.paper });
      page.drawText("Settlement report", { x: MARGIN, y: 733, size: 23, font: embeddedFont, color: COLORS.paper });
      drawFit(page, group.name, embeddedFont, { x: MARGIN, y: 709, size: 13, maxWidth: 340, color: COLORS.paper });
      page.drawText(`${formatReportDate(generatedAt)}  ·  Currency: ${reportCurrency}`, { x: MARGIN, y: 689, size: 8.5, font: embeddedFont, color: rgb(0.88, 0.93, 0.89) });
      drawFit(page, dataSource, embeddedFont, { x: PAGE_WIDTH - 220, y: 689, size: 8, maxWidth: 176, color: rgb(0.88, 0.93, 0.89) });
      y = 650;
      return;
    }
    page.drawRectangle({ x: 0, y: 738, width: PAGE_WIDTH, height: 54, color: COLORS.brand });
    page.drawText("SPLITZY", { x: MARGIN, y: 765, size: 8, font: embeddedFont, color: COLORS.paper });
    drawFit(page, `${group.name}  ·  ${title}`, embeddedFont, { x: MARGIN, y: 746, size: 10, maxWidth: CONTENT_WIDTH, color: COLORS.paper });
    y = 716;
  }

  function drawFooter() {
    for (const [index, footerPage] of pages.entries()) {
      footerPage.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_WIDTH - MARGIN, y: 34 }, thickness: 0.6, color: COLORS.line });
      footerPage.drawText("Splitzy  ·  Suggested settlement based on saved expenses", { x: MARGIN, y: 20, size: 7.5, font: embeddedFont, color: COLORS.muted });
      const pageLabel = `Page ${index + 1} of ${pages.length}`;
      footerPage.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - embeddedFont.widthOfTextAtSize(pageLabel, 7.5), y: 20, size: 7.5, font: embeddedFont, color: COLORS.muted });
    }
  }

  function nextPage(title: string) {
    drawBrandHeader(title);
  }

  function ensureSpace(height: number, title = "Settlement report continued") {
    if (y - height < 52) nextPage(title);
  }

  function sectionTitle(title: string, subtitle?: string) {
    ensureSpace(32);
    page.drawText(title, { x: MARGIN, y, size: 13, font: embeddedFont, color: COLORS.brand });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.8, color: COLORS.line });
    y -= subtitle ? 20 : 18;
    if (subtitle) {
      page.drawText(subtitle, { x: MARGIN, y: y + 4, size: 8, font: embeddedFont, color: COLORS.muted });
      y -= 5;
    }
  }

  function drawSummaryCards() {
    const cards = [
      { label: "TOTAL GROUP EXPENSES", value: formatCents(totalExpensesCents, reportCurrency) },
      { label: "MEMBERS", value: String(group.members.length) },
      { label: "SAVED RECEIPTS", value: String(expenses.length) },
      { label: "SUGGESTED TRANSFERS", value: String(transfers.length) },
    ];
    const gap = 9;
    const width = (CONTENT_WIDTH - gap * 3) / 4;
    const height = 55;
    ensureSpace(height + 10);
    cards.forEach((card, index) => {
      const x = MARGIN + index * (width + gap);
      page.drawRectangle({ x, y: y - height, width, height, color: COLORS.light, borderColor: COLORS.line, borderWidth: 0.5 });
      drawFit(page, card.label, embeddedFont, { x: x + 9, y: y - 17, size: 6.3, maxWidth: width - 18, color: COLORS.muted });
      drawFit(page, card.value, embeddedFont, { x: x + 9, y: y - 40, size: index === 0 ? 12 : 17, maxWidth: width - 18, color: COLORS.ink });
    });
    y -= height + 18;
  }

  function drawTransfer(transfer: Transfer) {
    ensureSpace(42);
    const height = 34;
    page.drawRectangle({ x: MARGIN, y: y - height, width: CONTENT_WIDTH, height, color: COLORS.light });
    page.drawRectangle({ x: MARGIN, y: y - height, width: 3, height, color: COLORS.brand });
    const debtor = names.get(transfer.fromMemberId) ?? "Group member";
    const creditor = names.get(transfer.toMemberId) ?? "Group member";
    drawFit(page, debtor, embeddedFont, { x: MARGIN + 12, y: y - 21, size: 10, maxWidth: 155, color: COLORS.owe });
    const arrowY = y - 17;
    const arrowX = MARGIN + 180;
    page.drawLine({ start: { x: arrowX, y: arrowY }, end: { x: arrowX + 14, y: arrowY }, thickness: 1.2, color: COLORS.muted });
    page.drawLine({ start: { x: arrowX + 9, y: arrowY + 4 }, end: { x: arrowX + 14, y: arrowY }, thickness: 1.2, color: COLORS.muted });
    page.drawLine({ start: { x: arrowX + 9, y: arrowY - 4 }, end: { x: arrowX + 14, y: arrowY }, thickness: 1.2, color: COLORS.muted });
    drawFit(page, creditor, embeddedFont, { x: MARGIN + 203, y: y - 21, size: 10, maxWidth: 155, color: COLORS.green });
    const amount = formatCents(transfer.amountCents, reportCurrency);
    page.drawText(amount, { x: PAGE_WIDTH - MARGIN - 12 - embeddedFont.widthOfTextAtSize(amount, 11), y: y - 21, size: 11, font: embeddedFont, color: COLORS.ink });
    y -= height + 6;
  }

  function drawBalance(member: SettlementMember, balance: number, x: number, width: number) {
    const height = 38;
    const isOwed = balance < 0;
    const isReceivable = balance > 0;
    const accent = isOwed ? COLORS.owe : isReceivable ? COLORS.green : COLORS.muted;
    const pale = isOwed ? COLORS.owePale : isReceivable ? COLORS.greenPale : COLORS.light;
    page.drawRectangle({ x, y: y - height, width, height, color: pale });
    page.drawRectangle({ x, y: y - height, width: 3, height, color: accent });
    drawFit(page, member.name, embeddedFont, { x: x + 10, y: y - 15, size: 8.5, maxWidth: width - 20, color: COLORS.ink });
    const value = isOwed ? `− ${formatCents(-balance, reportCurrency)}  ·  Owes` : isReceivable ? `+ ${formatCents(balance, reportCurrency)}  ·  Receives` : `${formatCents(0, reportCurrency)}  ·  No balance due`;
    drawFit(page, value, embeddedFont, { x: x + 10, y: y - 29, size: 8.5, maxWidth: width - 20, color: accent });
  }

  function drawBalances() {
    sectionTitle("Member net balances", "Positive amounts are receivable; negative amounts are owed.");
    const gap = 10;
    const width = (CONTENT_WIDTH - gap) / 2;
    for (let i = 0; i < group.members.length; i += 2) {
      ensureSpace(42);
      drawBalance(group.members[i], balances.get(group.members[i].id) ?? 0, MARGIN, width);
      if (group.members[i + 1]) drawBalance(group.members[i + 1], balances.get(group.members[i + 1].id) ?? 0, MARGIN + width + gap, width);
      y -= 58;
    }
  }

  function drawExpenseTableHeader() {
    const top = y;
    page.drawRectangle({ x: MARGIN, y: top - 20, width: CONTENT_WIDTH, height: 20, color: COLORS.light });
    page.drawText("ITEM", { x: MARGIN + 7, y: top - 14, size: 7, font: embeddedFont, color: COLORS.muted });
    page.drawText("QTY", { x: MARGIN + 190, y: top - 14, size: 7, font: embeddedFont, color: COLORS.muted });
    page.drawText("ASSIGNED TO", { x: MARGIN + 230, y: top - 14, size: 7, font: embeddedFont, color: COLORS.muted });
    const amountLabel = "ITEM SHARE";
    page.drawText(amountLabel, { x: PAGE_WIDTH - MARGIN - 7 - embeddedFont.widthOfTextAtSize(amountLabel, 7), y: top - 14, size: 7, font: embeddedFont, color: COLORS.muted });
    y -= 20;
  }

  function drawExpenseHeading(expense: ExpenseRecord, continued = false) {
    ensureSpace(38, "Saved receipt details");
    const total = getExpenseSubtotalCents(expense) + expense.taxCents + expense.tipCents;
    const title = continued ? `${expense.description}  ·  continued` : expense.description;
    drawFit(page, title, embeddedFont, { x: MARGIN + 2, y: y - 13, size: 10.5, maxWidth: 340, color: COLORS.ink });
    const amount = formatCents(total, reportCurrency);
    page.drawText(amount, { x: PAGE_WIDTH - MARGIN - 2 - embeddedFont.widthOfTextAtSize(amount, 10.5), y: y - 13, size: 10.5, font: embeddedFont, color: COLORS.ink });
    y -= 28;
    const date = formatExpenseDate(expense.createdAt);
    const payer = names.get(expense.paidByMemberId) ?? "Group member";
    drawFit(page, `${date ? `${date}  ·  ` : ""}Paid by ${payer}`, embeddedFont, { x: MARGIN + 2, y: y - 2, size: 8, maxWidth: CONTENT_WIDTH - 4, color: COLORS.muted });
    y -= 14;
    drawExpenseTableHeader();
  }

  function drawItemRow(expense: ExpenseRecord, item: ExpenseRecord["items"][number]) {
    const memberIds = group.members.map((member) => member.id);
    const shares = calculateItemSharesCents(item, memberIds);
    const assignedNames = item.assignedMemberIds.map((id) => names.get(id)).filter((name): name is string => Boolean(name));
    const assignedText = assignedNames.join(", ");
    const allocations = [...shares].map(([memberId, amount]) => `${names.get(memberId) ?? "Group member"} ${formatCents(amount, reportCurrency)}`).join("  ·  ");
    const itemLines = wrapText(item.name, embeddedFont, 8.5, 170);
    const assignmentLines = wrapText(assignedText, embeddedFont, 7.5, 145);
    const allocationLines = wrapText(allocations, embeddedFont, 7.5, 120);
    const noteLines = item.note?.trim() ? wrapText(item.note.trim(), embeddedFont, 7, 164) : [];
    const mainLines = Math.max(itemLines.length, assignmentLines.length, allocationLines.length, 1);
    const height = 9 + mainLines * 11 + noteLines.length * 9 + 4;
    if (y - height < 52) {
      nextPage("Saved receipt details continued");
      drawExpenseHeading(expense, true);
    }
    const rowTop = y;
    page.drawText(String(item.quantity), { x: MARGIN + 190, y: rowTop - 13, size: 8, font: embeddedFont, color: COLORS.ink });
    itemLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 7, y: rowTop - 13 - index * 11, size: 8.5, font: embeddedFont, color: COLORS.ink }));
    assignmentLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 230, y: rowTop - 13 - index * 11, size: 7.5, font: embeddedFont, color: COLORS.muted }));
    allocationLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 345, y: rowTop - 13 - index * 11, size: 7.5, font: embeddedFont, color: COLORS.ink }));
    noteLines.forEach((line, index) => page.drawText(line, { x: MARGIN + 7, y: rowTop - 13 - mainLines * 11 - index * 9, size: 7, font: embeddedFont, color: COLORS.muted }));
    y -= height;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.45, color: COLORS.line });
    y -= 5;
  }

  drawBrandHeader("Settlement report", true);
  drawSummaryCards();
  sectionTitle("Who pays whom", "Suggested payment direction, calculated from saved expenses.");
  if (transfers.length) transfers.forEach(drawTransfer);
  else {
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: y - 30, width: CONTENT_WIDTH, height: 30, color: COLORS.light });
    page.drawText("No transfers are due from these saved expenses.", { x: MARGIN + 10, y: y - 19, size: 9, font: embeddedFont, color: COLORS.muted });
    y -= 37;
  }
  ensureSpace(18);
  page.drawText("Suggested amounts only. Splitzy does not confirm that a payment was made.", { x: MARGIN, y: y - 3, size: 7, font: embeddedFont, color: COLORS.muted });
  y -= 18;
  drawBalances();

  if (expenses.length) {
    if (y < 235) drawBrandHeader("Saved receipt details");
    sectionTitle("Saved receipt details", "Item shares use the existing Splitzy calculations; tax and tip are shown as recorded.");
    for (const expense of expenses) {
      ensureSpace(64, "Saved receipt details");
      drawExpenseHeading(expense);
      for (const item of expense.items) drawItemRow(expense, item);
      if (expense.taxCents > 0 || expense.tipCents > 0) {
        ensureSpace(23, "Saved receipt details continued");
        const details = [expense.taxCents > 0 ? `Tax ${formatCents(expense.taxCents, reportCurrency)}` : "", expense.tipCents > 0 ? `Tip ${formatCents(expense.tipCents, reportCurrency)}` : ""].filter(Boolean).join("  ·  ");
        page.drawText(details, { x: PAGE_WIDTH - MARGIN - embeddedFont.widthOfTextAtSize(details, 7.5), y: y - 3, size: 7.5, font: embeddedFont, color: COLORS.muted });
        y -= 19;
      }
      y -= 8;
    }
  }

  drawFooter();
  return pdf.save({ useObjectStreams: false });
}
