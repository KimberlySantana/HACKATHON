import { NextResponse } from "next/server";
import { mockReceipt } from "@/lib/receipt/mock";

/** Keeps the sample fixture available to local developers without exposing it as production scanning. */
export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Receipt scanning is not available." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(mockReceipt, { headers: { "Cache-Control": "no-store" } });
}
