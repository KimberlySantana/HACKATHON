import type { Receipt } from "@/types";

export type ReceiptReview = {
  needsReview: boolean;
  needsConfirmation: boolean;
  confidence: "high" | "medium" | "low";
  fields: string[];
  notes: string[];
};

export type ReceiptScanResult = {
  receipt: Receipt;
  review: ReceiptReview;
};
