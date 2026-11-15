import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Receipt, ReceiptItem } from "@/types";
import type { ReceiptReview, ReceiptScanResult } from "@/lib/receipt/extraction";
import { validateScanContentLength, validateScanImage, validateScanTotalSize } from "@/lib/receipt/upload-validation";

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
        required: ["upload_slot", "detected_type", "merchant", "date", "items", "subtotal", "tax", "tip", "tip_status", "suggested_tip_percentages", "total", "confidence", "review_notes"],
        properties: {
          upload_slot: { type: "string", enum: ["itemized", "payment"] },
          detected_type: { type: "string", enum: ["itemized", "payment", "combined", "unknown"] },
          merchant: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
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
          tip: { type: ["number", "null"] },
          tip_status: { type: "string", enum: ["actual", "blank", "suggested_only", "not_present", "unclear"] },
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
  items: ExtractedItem[];
  subtotal: number | null;
  tax: number | null;
  tip: number | null;
  tip_status: TipStatus;
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
- Use an ISO date (YYYY-MM-DD) only when the date is legible.
- Put purchased line items only in a document that visibly contains the itemized lines. The payment receipt usually has an empty items array; never duplicate item lines across documents.
- Use tax and subtotal only when visibly printed. Keep them separate from tip and final total.
- tip_status must be actual only when an explicit tip amount is shown. Use blank when the tip label is present but empty, suggested_only when only suggested percentages or suggested amounts are shown, not_present when no tip information is shown, and unclear when the line cannot be interpreted.
- When tip_status is blank, suggested_only, not_present, or unclear, tip must be null. Never convert a blank tip line or suggested tip percentage into an actual zero or actual tip.
- The final total must be the charged amount shown on the receipt, not a calculation you invented.
- same_transaction is true only when the merchant/date/amount evidence supports that the images belong together, false when there is a clear mismatch, and null when you cannot tell.
- Add concise review notes for ambiguity, missing values, conflicting totals, or possible transaction mismatches.`;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    const unitPrice = isFiniteNumber(item.unit_price) && item.unit_price >= 0 ? roundMoney(item.unit_price) : 0;
    const calculatedTotal = roundMoney(quantity * unitPrice);
    const total = isFiniteNumber(item.total) && item.total >= 0 ? roundMoney(item.total) : calculatedTotal;

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

  const calculatedSubtotal = roundMoney(items.reduce((sum, item) => sum + item.total, 0));
  const subtotal = isFiniteNumber(itemizedDocument?.subtotal ?? null) && (itemizedDocument?.subtotal ?? 0) >= 0
    ? roundMoney(itemizedDocument?.subtotal ?? 0)
    : calculatedSubtotal;
  const tax = isFiniteNumber(itemizedDocument?.tax ?? null) && (itemizedDocument?.tax ?? 0) >= 0
    ? roundMoney(itemizedDocument?.tax ?? 0)
    : 0;

  if (!itemizedDocument) flag("receipt", "No clearly itemized receipt was detected. Review the extracted items and charges.");
  if (!isFiniteNumber(itemizedDocument?.subtotal ?? null)) flag("subtotal", "Itemized subtotal is missing or unreadable; it was calculated from the extracted items.");
  if (!isFiniteNumber(itemizedDocument?.tax ?? null)) flag("tax", "Itemized tax is missing or unreadable.");
  if (itemizedDocument && itemizedDocument.confidence !== "high") flag("receipt", "The itemized receipt has lower-confidence values that should be checked.");

  const itemizedActualTip = itemizedDocument?.tip_status === "actual" && isFiniteNumber(itemizedDocument.tip) && itemizedDocument.tip >= 0
    ? roundMoney(itemizedDocument.tip)
    : null;
  const paymentActualTip = paymentDocument?.tip_status === "actual" && isFiniteNumber(paymentDocument.tip) && paymentDocument.tip >= 0
    ? roundMoney(paymentDocument.tip)
    : null;
  const tip = paymentActualTip ?? itemizedActualTip ?? 0;

  if (paymentDocument?.tip_status === "blank") flag("tip", "The payment receipt has a blank tip line. Tip was not assumed to be zero—confirm it manually.");
  if (paymentDocument?.tip_status === "suggested_only") flag("tip", "The payment receipt shows suggested tip options only. They were not treated as an actual tip.");
  if (paymentDocument?.tip_status === "unclear") flag("tip", "The payment receipt tip line is unclear. Confirm the actual tip manually.");
  if (!paymentDocument && itemizedActualTip === null) flag("tip", "No confirmed actual tip was found. Enter the tip manually.");
  if (paymentDocument?.tip_status === "not_present" && itemizedActualTip === null) flag("tip", "No actual tip amount was found on the receipts. Enter the tip manually.");
  if (paymentActualTip !== null && itemizedActualTip !== null && Math.abs(paymentActualTip - itemizedActualTip) > 0.02) {
    flag("tip", "The two receipts show different tip amounts. Confirm the actual tip.");
  }

  const itemizedTotal = isFiniteNumber(itemizedDocument?.total ?? null) && (itemizedDocument?.total ?? 0) >= 0
    ? roundMoney(itemizedDocument?.total ?? 0)
    : null;
  const paymentTotal = isFiniteNumber(paymentDocument?.total ?? null) && (paymentDocument?.total ?? 0) >= 0
    ? roundMoney(paymentDocument?.total ?? 0)
    : null;
  const total = paymentTotal ?? itemizedTotal ?? roundMoney(subtotal + tax + tip);

  if (paymentTotal !== null && itemizedTotal !== null && Math.abs(paymentTotal - itemizedTotal) > 0.05) {
    flag("total", `The payment receipt total (${paymentTotal.toFixed(2)}) conflicts with the itemized receipt total (${itemizedTotal.toFixed(2)}). Confirm the charged amount.`);
  }
  if (paymentDocument && paymentTotal === null) flag("total", "Final charged total is missing or unreadable on the payment receipt.");
  if (!paymentDocument && itemizedTotal === null) flag("total", "Final charged total is missing or unreadable.");
  if (Math.abs(total - roundMoney(subtotal + tax + tip)) > 0.05) addNote("The charged total differs from subtotal + tax + tip; review the highlighted total.");

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
    items,
  };

  return { receipt, review };
}

function fileToImagePart(file: File, bytes: Uint8Array) {
  const imageDataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
  return { type: "input_image" as const, image_url: imageDataUrl, detail: "high" as const };
}

export async function POST(request: Request) {
  // The MVP release fails closed until authenticated scanning and quota setup are verified.
  if (process.env.ENABLE_RECEIPT_SCANNING !== "true") {
    return NextResponse.json({ code: "SCANNER_DISABLED", error: "Receipt scanning is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return NextResponse.json({ error: "Receipt scanning requests must come from this website." }, { status: 403, headers: { "Cache-Control": "no-store" } });
      }
    } catch {
      return NextResponse.json({ error: "Receipt scanning requests must come from this website." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }

  let supabase;
  try {
    supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sign in before using receipt scanning." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return NextResponse.json({ error: "Sign-in verification is unavailable. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Receipt scanning is not configured yet. Add OPENAI_API_KEY to the server environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const contentLengthError = validateScanContentLength(request.headers.get("content-length"));
  if (contentLengthError) {
    return NextResponse.json({ error: contentLengthError }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: "The receipt upload could not be read. Choose the images again." }, { status: 400 });
    }
    const uploads = [
      { slot: "itemized" as const, label: "Itemized Receipt", file: formData.get("itemizedFile") },
      { slot: "payment" as const, label: "Payment/Tip Receipt", file: formData.get("paymentFile") },
    ].filter((upload): upload is { slot: "itemized" | "payment"; label: string; file: File } => upload.file instanceof File);

    if (uploads.length === 0 || uploads.length > 2) {
      return NextResponse.json({ error: "Upload an itemized receipt, a payment receipt, or both." }, { status: 400 });
    }

    const totalImageBytes = uploads.reduce((total, upload) => total + upload.file.size, 0);
    const totalSizeError = validateScanTotalSize(totalImageBytes);
    if (totalSizeError) return NextResponse.json({ error: totalSizeError }, { status: 413, headers: { "Cache-Control": "no-store" } });

    const validatedUploads = await Promise.all(uploads.map(async (upload) => {
      const bytes = new Uint8Array(await upload.file.arrayBuffer());
      return { ...upload, bytes, validationError: validateScanImage(upload.file.type, upload.file.size, bytes, upload.label) };
    }));
    const invalidUpload = validatedUploads.find((upload) => upload.validationError);
    if (invalidUpload?.validationError) {
      return NextResponse.json({ error: invalidUpload.validationError }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const { data: quotaReserved, error: quotaError } = await supabase.rpc("reserve_receipt_scan");
    if (quotaError) {
      return NextResponse.json({ error: "Secure scan limits are not configured yet. Apply the receipt scan usage migration, then try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (quotaReserved !== true) {
      return NextResponse.json({ error: "The daily receipt scanning limit has been reached. Try again tomorrow." }, { status: 429, headers: { "Cache-Control": "no-store" } });
    }

    const uploadParts = validatedUploads.map((upload) => [
      { type: "input_text" as const, text: `--- ${upload.label} (upload_slot: ${upload.slot}) ---` },
      fileToImagePart(upload.file, upload.bytes),
    ]).flat();
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
  } catch {
    console.error("OpenAI multi-receipt extraction failed.");
    return NextResponse.json({ error: "Receipt recognition failed. Please try again or check the images." }, { status: 502 });
  }
}
