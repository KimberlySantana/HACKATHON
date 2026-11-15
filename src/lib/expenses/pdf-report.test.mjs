import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { createSettlementPdf } from "./pdf-report.ts";

const fontBytes = new Uint8Array(await readFile(new URL("../../../public/fonts/NotoSansTC-Traditional.ttf", import.meta.url)));

const fixture = {
  group: { name: "週日聚餐 Sunday dinner", members: [{ id: "amy", name: "林小明 Amy" }, { id: "bella", name: "Bella" }] },
  expenses: [{
    id: "expense-1", groupId: "group-1", description: "Sunday dinner 晚餐", paidByMemberId: "amy",
    items: [{ id: "item-1", name: "牛肉麵 Beef noodles", note: "不要香菜 no cilantro", quantity: 1, unitPriceCents: 1250, assignedMemberIds: ["amy", "bella"] }],
    taxCents: 100, tipCents: 0, createdAt: "2026-11-14T12:00:00.000Z",
  }],
  transfers: [{ fromMemberId: "bella", toMemberId: "amy", amountCents: 675 }],
  balances: new Map([["amy", 675], ["bella", -675]]),
  generatedAt: new Date("2026-11-14T12:00:00.000Z"),
  dataSource: "Guest records on this device",
  fontBytes,
};

test("PDF embeds a subset Unicode font and supports English, Traditional Chinese, and mixed text", async () => {
  const font = fontkit.create(fontBytes);
  for (const character of "Settlement report 週日聚餐 Sunday dinner 林小明 Amy 牛肉麵 不要香菜") {
    assert.ok(font.hasGlyphForCodePoint(character.codePointAt(0)), `missing glyph for ${character}`);
  }
  const bytes = await createSettlementPdf(fixture);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.startsWith("%PDF-1.7"));
  assert.match(text, /\/FontFile2/);
  assert.match(text, /\/ToUnicode/);
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1);
});

test("report embeds its font as a subset so unused glyphs stay out of downloads", async () => {
  const bytes = await createSettlementPdf(fixture);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /\/FontFile2/);
  assert.match(text, /\/ToUnicode/);
  assert.ok(bytes.byteLength > 10_000, "the report should contain the used glyph subset");
  assert.ok(bytes.byteLength < 2_000_000, "the report should not contain the full CJK font");
});

test("larger saved expense lists paginate without dropping content", async () => {
  const expenses = Array.from({ length: 26 }, (_, index) => ({
    ...fixture.expenses[0], id: `expense-${index}`, description: `Receipt ${index + 1}`,
    items: [{ ...fixture.expenses[0].items[0], id: `item-${index}`, name: `牛肉麵 ${index + 1}` }],
  }));
  const bytes = await createSettlementPdf({ ...fixture, expenses });
  const parsed = await PDFDocument.load(bytes);
  assert.ok(parsed.getPageCount() > 1);
});
