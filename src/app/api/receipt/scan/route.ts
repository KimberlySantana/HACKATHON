import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { Receipt, ReceiptItem } from "@/types";
import type { ReceiptReview, ReceiptScanResult } from "@/lib/receipt/extraction";
import { isCurrencyCode, minorUnitFactor, type CurrencyCode } from "@/lib/currency/types";
import { calculatePercentageMinorUnits, parsePercentageToPpm, type TaxBasis, type TaxStatus, type TipBasis } from "@/lib/finance/percentages";
import { majorToMinorUnits } from "@/lib/currency/money";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["documents", "transaction"],
  properties: {
    documents: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["upload_slot", "detected_type", "merchant", "date", "currency", "items", "subtotal", "tax", "tax_percentage", "tax_status", "taxable_subtotal", "tax_basis", "tip", "tip_percentage", "tip_status", "tip_basis", "suggested_tip_percentages", "total", "confidence", "review_notes"],
        properties: {
          upload_slot: { type: "string", enum: ["itemized", "payment"] },
          detected_type: { type: "string", enum: ["itemized", "payment", "combined", "unknown"] },
          merchant: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          currency: { type: ["string", "null"] },
          tax_percentage: { type: ["number", "null"] },
          tax_status: { type: "string", enum: ["amount_printed", "percentage_printed", "included", "not_charged", "unknown"] },
          taxable_subtotal: { type: ["number", "null"] },
          tax_basis: { type: "string", enum: ["subtotal", "taxable_subtotal", "unknown"] },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "quantity", "unit_price", "total", "confidence", "review_note"],
              properties: {
                name: { type: ["string", "null"] },
                quantity: { type: ["number", "null"] },
                unit_price: { type: ["number", "null"] },
                total: { type: ["number", "null"] },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                review_note: { type: ["string", "null"] },
              },
            },
          },
          subtotal: { type: ["number", "null"] },
          tax: { type: ["number", "null"] },
          tip_percentage: { type: ["number", "null"] },
          tip: { type: ["number", "null"] },
          tip_status: { type: "string", enum: ["actual", "blank", "suggested_only", "not_present", "unclear"] },
          tip_basis: { type: "string", enum: ["pre_tax_subtotal", "post_tax_subtotal", "unknown"] },
          suggested_tip_percentages: { type: "array", items: { type: "number" } },
          total: { type: ["number", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          review_notes: { type: "array", items: { type: "string" } },
        },
      },
    },
    transaction: {
      type: "object",
      additionalProperties: false,
      required: ["same_transaction", "confidence", "reasons"],
      properties: {
        same_transaction: { type: ["boolean", "null"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        reasons: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

type Confidence = "high" | "medium" | "low";
type TipStatus = "actual" | "blank" | "suggested_only" | "not_present" | "unclear";

type ExtractedItem = {
  name: string | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  confidence: Confidence;
  review_note: string | null;
};

type ExtractedDocument = {
  upload_slot: "itemized" | "payment";
  detected_type: "itemized" | "payment" | "combined" | "unknown";
  merchant: string | null;
  date: string | null;
  currency: string | null;
  tax_percentage: number | null;
  tax_status: TaxStatus;
  taxable_subtotal: number | null;
  tax_basis: TaxBasis;
  items: ExtractedItem[];
  subtotal: number | null;
  tax: number | null;
  tip_percentage: number | null;
  tip: number | null;
  tip_status: TipStatus;
  tip_basis: TipBasis;
  suggested_tip_percentages: number[];
  total: number | null;
  confidence: Confidence;
  review_notes: string[];
};

type ExtractedReceipt = {
  documents: ExtractedDocument[];
  transaction: {
    same_transaction: boolean | null;
    confidence: Confidence;
    reasons: string[];
  };
};

const extractionInstructions = `You extract and reconcile one or two receipt images for the same bill-splitting app.

Each image is preceded by an upload slot label: itemized or payment. Return exactly one document object per image and preserve that upload_slot label.

Receipt roles:
- An itemized receipt contains purchased food/drink lines, subtotal, and tax.
- A payment receipt contains the final charged total and may contain the actual tip.
- A combined receipt can contain both itemized lines and payment/tip information.
- Classify each image as itemized, payment, combined, or unknown based on what is visibly present.

Rules:
- Never guess or invent text or numbers. Use null when a value is missing, cropped, or unreadable.
- Identify currency only from a visible currency code, symbol, or unmistakable receipt evidence. Return an ISO code such as USD, EUR, CNY, or KRW when supported; otherwise return null. Never infer currency from the website language or upload slot.
- Extract tax_percentage only when a tax rate is visibly printed. Classify tax_status as amount_printed when a tax amount is printed, percentage_printed when a rate is printed but the amount is absent, included when tax is explicitly included in prices or the receipt says tax included, not_charged when it explicitly says no tax/no charge, and unknown when unclear.
- Return taxable_subtotal only when visibly printed or reliably determinable from the itemized receipt. Use tax_basis subtotal when the printed rate applies to the itemized subtotal, taxable_subtotal only when a distinct taxable base is visible or reliable, and unknown otherwise. Never invent a tax rate from location.
- Use an ISO date (YYYY-MM-DD) only when the date is legible.
- Put purchased line items only in a document that visibly contains the itemized lines. The payment receipt usually has an empty items array; never duplicate item lines across documents.
- Use tax and subtotal only when visibly printed. Keep them separate from tip and final total.
- tip_status must be actual only when an explicit tip amount is shown. Use blank when the tip label is present but empty, suggested_only when only suggested percentages or suggested amounts are shown, not_present when no tip information is shown, and unclear when the line cannot be interpreted.
- Extract tip_percentage only for an explicit actual tip percentage selected/written on the receipt; do not put suggested percentages there. Set tip_basis to pre_tax_subtotal or post_tax_subtotal only when the receipt makes the basis clear; otherwise use unknown.
- When tip_status is blank, suggested_only, not_present, or unclear, tip must be null. Never convert a blank tip line or suggested tip percentage into an actual zero or actual tip.
- The final total must be the charged amount shown on the receipt, not a calculation you invented.
- same_transaction is true only when the merchant/date/amount evidence supports that the images belong together, false when there is a clear mismatch, and null when you cannot tell.
- Add concise review notes for ambiguity, missing values, conflicting totals, or possible transaction mismatches.`;

function roundMoney(value: number, currency?: CurrencyCode | null) {
  const factor = currency ? minorUnitFactor(currency) : 100;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatMajor(value: number, currency?: CurrencyCode | null) {
  return value.toFixed(currency && minorUnitFactor(currency) === 1 ? 0 : 2);
}

function isFiniteNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function confidenceRank(confidence: Confidence) {
  return confidence === "low" ? 0 : confidence === "medium" ? 1 : 2;
}

function lowerConfidence(left: Confidence, right: Confidence): Confidence {
  return confidenceRank(left) <= confidenceRank(right) ? left : right;
}

function normalizeMerchant(value: string | null) {
  return value?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
}

function merchantsMayMatch(left: string, right: string) {
  return left === right || left.includes(right) || right.includes(left);
}

function validPercentage(value: number | null) {
  return isFiniteNumber(value) && value >= 0 && value <= 100 ? value : null;
}

function calculateMajorPercentage(baseMajor: number, percentage: number, currency: CurrencyCode | null) {
  if (!currency || !isFiniteNumber(baseMajor) || baseMajor < 0) return null;
  const ppm = parsePercentageToPpm(String(percentage));
  if (ppm === null) return null;
  try {
    const baseMinor = majorToMinorUnits(baseMajor, currency);
    const resultMinor = calculatePercentageMinorUnits(baseMinor, ppm);
    return Number((resultMinor / minorUnitFactor(currency)).toFixed(minorUnitFactor(currency) === 1 ? 0 : 2));
  } catch {
    return null;
  }
}

function mergeExtraction(extracted: ExtractedReceipt, imageCount: number): ReceiptScanResult {
  const fields = new Set<string>();
  const notes: string[] = [];
  let confidence: Confidence = extracted.transaction.confidence;

  function addNote(note: string) {
    const trimmed = note.trim();
    if (trimmed && !notes.includes(trimmed)) notes.push(trimmed);
  }

  function flag(field: string, note: string) {
    fields.add(field);
    addNote(note);
  }

  for (const document of extracted.documents) {
    confidence = lowerConfidence(confidence, document.confidence);
    document.review_notes.forEach(addNote);
  }

  const itemizedDocument = extracted.documents.find((document) => document.detected_type === "itemized")
    ?? extracted.documents.find((document) => document.upload_slot === "itemized")
    ?? extracted.documents.find((document) => document.detected_type === "combined");
  const paymentDocument = extracted.documents.find((document) => document.detected_type === "payment")
    ?? extracted.documents.find((document) => document.upload_slot === "payment")
    ?? extracted.documents.find((document) => document.detected_type === "combined" && document !== itemizedDocument)
    ?? extracted.documents.find((document) => document.detected_type === "combined");
  const hasTwoDocuments = imageCount === 2;

  if (hasTwoDocuments && extracted.transaction.same_transaction !== true) {
    flag("transaction", extracted.transaction.same_transaction === false
      ? "These receipts may not belong to the same transaction. Confirm before splitting."
      : "I could not confidently confirm that these receipts belong to the same transaction.");
  }
  extracted.transaction.reasons.forEach((reason) => {
    if (hasTwoDocuments) addNote(reason);
  });

  if (itemizedDocument && paymentDocument && itemizedDocument !== paymentDocument) {
    const itemizedMerchant = normalizeMerchant(itemizedDocument.merchant);
    const paymentMerchant = normalizeMerchant(paymentDocument.merchant);
    if (itemizedMerchant && paymentMerchant && !merchantsMayMatch(itemizedMerchant, paymentMerchant)) {
      flag("transaction", "Merchant names differ between the two receipts. Confirm they belong to the same bill.");
    }

    if (itemizedDocument.date && paymentDocument.date && itemizedDocument.date !== paymentDocument.date) {
      flag("transaction", "Dates differ between the two receipts. Confirm they belong to the same bill.");
    }
  }

  const sourceForBill = itemizedDocument ?? paymentDocument;
  const merchant = sourceForBill?.merchant?.trim() ?? "";
  const date = sourceForBill?.date?.trim() ?? "";
  const sourceCurrency = [itemizedDocument?.currency, paymentDocument?.currency]
    .map((value) => value?.trim().toUpperCase())
    .find((value) => value && isCurrencyCode(value)) ?? "";
  const currency: CurrencyCode | null = isCurrencyCode(sourceCurrency) ? sourceCurrency : null;
  const documentCurrencies = extracted.documents.map((document) => document.currency?.trim().toUpperCase()).filter(Boolean);
  if (documentCurrencies.some((value) => !isCurrencyCode(value))) flag("currency", "Receipt currency is missing or unsupported. Confirm the original currency manually.");
  if (new Set(documentCurrencies.filter(isCurrencyCode)).size > 1) flag("currency", "The two receipts show different currencies. Confirm the original currency before splitting.");
  if (!currency) flag("currency", "Receipt currency is missing or unsupported. Confirm the original currency manually.");
  if (!merchant) flag("merchant", "Merchant name is missing or unreadable.");
  if (!date) flag("date", "Receipt date is missing or unreadable.");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) flag("date", "Date format could not be validated.");

  const sourceItems = itemizedDocument?.items ?? [];
  if (!itemizedDocument && paymentDocument?.items.length) {
    flag("receipt", "No itemized receipt was detected, so items were read from the payment image. Check for duplicates.");
  }

  const items: ReceiptItem[] = sourceItems.map((item, index) => {
    const fieldPrefix = `items[${index}]`;
    const name = item.name?.trim() ?? "";
    const quantity = isFiniteNumber(item.quantity) && item.quantity > 0 ? item.quantity : 0;
    const unitPrice = isFiniteNumber(item.unit_price) && item.unit_price >= 0 ? roundMoney(item.unit_price, currency) : 0;
    const calculatedTotal = roundMoney(quantity * unitPrice, currency);
    const total = isFiniteNumber(item.total) && item.total >= 0 ? roundMoney(item.total, currency) : calculatedTotal;

    if (!name) flag(`${fieldPrefix}.name`, `Item ${index + 1} name is missing or unreadable.`);
    if (quantity === 0) flag(`${fieldPrefix}.quantity`, `Quantity for item ${index + 1} is missing or unreadable.`);
    if (!isFiniteNumber(item.unit_price) || item.unit_price < 0) flag(`${fieldPrefix}.unit_price`, `Unit price for item ${index + 1} is missing or unreadable.`);
    if (!isFiniteNumber(item.total) || item.total < 0) flag(`${fieldPrefix}.total`, `Line total for item ${index + 1} is missing or unreadable.`);
    if (isFiniteNumber(item.total) && Math.abs(total - calculatedTotal) > 0.02) flag(`${fieldPrefix}.total`, `Line total for item ${index + 1} does not match quantity × unit price.`);
    if (item.confidence !== "high") flag(fieldPrefix, item.review_note || `Item ${index + 1} should be checked.`);
    if (item.review_note) addNote(item.review_note);
    confidence = lowerConfidence(confidence, item.confidence);

    return { id: `item-${index + 1}`, name, quantity, unitPrice, total, assignedMemberIds: [] };
  });

  const calculatedSubtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0), currency);
  const subtotal = isFiniteNumber(itemizedDocument?.subtotal ?? null) && (itemizedDocument?.subtotal ?? 0) >= 0
    ? roundMoney(itemizedDocument?.subtotal ?? 0, currency)
    : calculatedSubtotal;
  const printedTax = isFiniteNumber(itemizedDocument?.tax ?? null) && (itemizedDocument?.tax ?? 0) >= 0
    ? roundMoney(itemizedDocument?.tax ?? 0, currency)
    : null;
  const taxPercentage = validPercentage(itemizedDocument?.tax_percentage ?? null);
  const taxStatus = itemizedDocument?.tax_status ?? "unknown";
  const taxBasis = itemizedDocument?.tax_basis ?? "unknown";
  const taxableBase = taxBasis === "taxable_subtotal"
    ? itemizedDocument?.taxable_subtotal ?? null
    : taxBasis === "subtotal"
      ? subtotal
      : null;
  let tax = printedTax ?? 0;
  let taxInferred = false;
  if (printedTax === null && taxStatus === "percentage_printed" && taxPercentage !== null && taxableBase !== null) {
    const calculatedTax = calculateMajorPercentage(taxableBase, taxPercentage, currency);
    if (calculatedTax !== null) {
      tax = calculatedTax;
      taxInferred = true;
      flag("tax", "Tax was calculated from the printed percentage and taxable subtotal. Confirm the calculated amount.");
    } else {
      flag("tax", "The printed tax percentage could not be calculated safely. Confirm the tax amount manually.");
    }
  } else if (printedTax === null && taxStatus === "included") {
    tax = 0;
    addNote("Tax is included in the item prices, so it was not added again.");
  } else if (printedTax === null && taxStatus === "not_charged") {
    tax = 0;
  }

  if (!itemizedDocument) flag("receipt", "No clearly itemized receipt was detected. Review the extracted items and charges.");
  if (!isFiniteNumber(itemizedDocument?.subtotal ?? null)) flag("subtotal", "Itemized subtotal is missing or unreadable; it was calculated from the extracted items.");
  if (printedTax === null && taxStatus === "amount_printed") flag("tax", "A tax amount was expected but could not be read. Confirm the tax amount manually.");
  if (printedTax === null && taxStatus === "unknown") flag("tax", "Itemized tax is missing or unreadable. Confirm whether tax was charged.");
  if (printedTax === null && taxStatus === "percentage_printed" && (taxPercentage === null || taxableBase === null)) flag("tax", "A tax percentage was found, but its taxable basis is unclear. Confirm the tax amount manually.");
  if (itemizedDocument && itemizedDocument.confidence !== "high") flag("receipt", "The itemized receipt has lower-confidence values that should be checked.");

  const itemizedActualTip = itemizedDocument?.tip_status === "actual" && isFiniteNumber(itemizedDocument.tip) && itemizedDocument.tip >= 0
    ? roundMoney(itemizedDocument.tip, currency)
    : null;
  const paymentActualTip = paymentDocument?.tip_status === "actual" && isFiniteNumber(paymentDocument.tip) && paymentDocument.tip >= 0
    ? roundMoney(paymentDocument.tip, currency)
    : null;
  const tipSource = paymentActualTip !== null ? paymentDocument : itemizedActualTip !== null ? itemizedDocument : paymentDocument ?? itemizedDocument;
  const actualTipPercentage = tipSource?.tip_status === "actual" ? validPercentage(tipSource.tip_percentage) : null;
  const tipBasis = tipSource?.tip_basis ?? "unknown";
  const tipBase = tipBasis === "post_tax_subtotal" ? subtotal + tax : tipBasis === "pre_tax_subtotal" ? subtotal : null;
  let tip = paymentActualTip ?? itemizedActualTip ?? 0;
  let tipInferred = false;
  if (paymentActualTip === null && itemizedActualTip === null && tipSource?.tip_status === "actual" && actualTipPercentage !== null && tipBase !== null) {
    const calculatedTip = calculateMajorPercentage(tipBase, actualTipPercentage, currency);
    if (calculatedTip !== null) {
      tip = calculatedTip;
      tipInferred = true;
      flag("tip", "Tip was calculated from the explicit tip percentage and its stated basis. Confirm the calculated amount.");
    } else {
      flag("tip", "The explicit tip percentage could not be calculated safely. Confirm the tip amount manually.");
    }
  }
  const suggestedTipPercentages = [...new Set(extracted.documents.flatMap((document) => document.suggested_tip_percentages.map(validPercentage).filter((value): value is number => value !== null)))].sort((left, right) => left - right);

  if (paymentDocument?.tip_status === "blank") flag("tip", "The payment receipt has a blank tip line. Tip was not assumed to be zero—confirm it manually.");
  if (paymentDocument?.tip_status === "suggested_only") flag("tip", "The payment receipt shows suggested tip options only. They were not treated as an actual tip.");
  if (paymentDocument?.tip_status === "unclear") flag("tip", "The payment receipt tip line is unclear. Confirm the actual tip manually.");
  if (!paymentDocument && itemizedActualTip === null && !tipInferred) flag("tip", "No confirmed actual tip was found. Enter the tip manually.");
  if (paymentDocument?.tip_status === "not_present" && itemizedActualTip === null) flag("tip", "No actual tip amount was found on the receipts. Enter the tip manually.");
  if (paymentActualTip !== null && itemizedActualTip !== null && Math.abs(paymentActualTip - itemizedActualTip) > 0.02) {
    flag("tip", "The two receipts show different tip amounts. Confirm the actual tip.");
  }

  const itemizedTotal = isFiniteNumber(itemizedDocument?.total ?? null) && (itemizedDocument?.total ?? 0) >= 0
    ? roundMoney(itemizedDocument?.total ?? 0, currency)
    : null;
  const paymentTotal = isFiniteNumber(paymentDocument?.total ?? null) && (paymentDocument?.total ?? 0) >= 0
    ? roundMoney(paymentDocument?.total ?? 0, currency)
    : null;
  const total = paymentTotal ?? itemizedTotal ?? roundMoney(subtotal + tax + tip, currency);

  if (paymentTotal !== null && itemizedTotal !== null && Math.abs(paymentTotal - itemizedTotal) > 0.05) {
    flag("total", `The payment receipt total (${formatMajor(paymentTotal, currency)}) conflicts with the itemized receipt total (${formatMajor(itemizedTotal, currency)}). Confirm the charged amount.`);
  }
  if (paymentDocument && paymentTotal === null) flag("total", "Final charged total is missing or unreadable on the payment receipt.");
  if (!paymentDocument && itemizedTotal === null) flag("total", "Final charged total is missing or unreadable.");
  if (Math.abs(total - roundMoney(subtotal + tax + tip, currency)) > (currency && minorUnitFactor(currency) === 1 ? 0 : 0.05)) addNote("The charged total differs from subtotal + tax + tip; review the highlighted total.");

  const review: ReceiptReview = {
    needsReview: fields.size > 0 || notes.length > 0,
    needsConfirmation: fields.has("transaction"),
    confidence,
    fields: [...fields],
    notes,
  };

  const receipt: Receipt = {
    id: `receipt-${Date.now()}`,
    groupId: "",
    merchant,
    date,
    subtotal,
    tax,
    tip,
    total,
    currency,
    taxPercentage,
    tipPercentage: actualTipPercentage,
    suggestedTipPercentages,
    taxStatus,
    taxBasis,
    tipBasis,
    taxInferred,
    tipInferred,
    items,
  };

  return { receipt, review };
}

async function fileToImagePart(file: File) {
  const imageDataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
  return { type: "input_image" as const, image_url: imageDataUrl, detail: "high" as const };
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Receipt scanning is not configured yet. Add OPENAI_API_KEY to .env.local." }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const uploads = [
      { slot: "itemized" as const, label: "Itemized Receipt", file: formData.get("itemizedFile") },
      { slot: "payment" as const, label: "Payment/Tip Receipt", file: formData.get("paymentFile") },
    ].filter((upload): upload is { slot: "itemized" | "payment"; label: string; file: File } => upload.file instanceof File);

    if (uploads.length === 0) {
      return NextResponse.json({ error: "Upload an itemized receipt, a payment receipt, or both." }, { status: 400 });
    }

    for (const upload of uploads) {
      if (!SUPPORTED_IMAGE_TYPES.has(upload.file.type)) {
        return NextResponse.json({ error: `${upload.label} must be a JPEG, PNG, WEBP, or GIF image.` }, { status: 400 });
      }
      if (upload.file.size === 0 || upload.file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: `${upload.label} must be between 1 byte and 10 MB.` }, { status: 400 });
      }
    }

    const uploadParts = (await Promise.all(uploads.map(async (upload) => [
      { type: "input_text" as const, text: `--- ${upload.label} (upload_slot: ${upload.slot}) ---` },
      await fileToImagePart(upload.file),
    ]))).flat();
    const content = [
      { type: "input_text" as const, text: extractionInstructions },
      ...uploadParts,
    ];

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model: process.env.OPENAI_RECEIPT_MODEL || "gpt-5.4-mini",
      input: [{ role: "user", content }],
      text: {
        format: {
          type: "json_schema",
          name: "multi_receipt_extraction",
          strict: true,
          schema: extractionSchema,
        },
      },
    });

    if (!response.output_text) {
      return NextResponse.json({ error: "OpenAI returned no receipt data. Please try clearer images." }, { status: 502 });
    }

    let extracted: ExtractedReceipt;
    try {
      extracted = JSON.parse(response.output_text) as ExtractedReceipt;
    } catch {
      return NextResponse.json({ error: "OpenAI returned an invalid receipt response. Please try again." }, { status: 502 });
    }

    return NextResponse.json(mergeExtraction(extracted, uploads.length));
  } catch (error) {
    console.error("OpenAI multi-receipt extraction failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Receipt recognition failed. Please try again or check the images." }, { status: 502 });
  }
}
