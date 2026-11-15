import { NextResponse } from "next/server";
import { isCurrencyCode, type CurrencyCode } from "@/lib/currency/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const base = url.searchParams.get("base")?.toUpperCase();
  const symbols = [...new Set((url.searchParams.get("symbols") ?? "").toUpperCase().split(",").filter(Boolean))];
  if (!isCurrencyCode(base) || symbols.length === 0 || symbols.some((symbol) => !isCurrencyCode(symbol))) {
    return NextResponse.json({ error: "Unsupported currency request." }, { status: 400 });
  }
  const targetSymbols = symbols.filter((symbol) => symbol !== base);
  if (targetSymbols.length === 0) {
    return NextResponse.json({ base, rates: {}, date: new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString() });
  }
  try {
    const provider = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${targetSymbols.join(",")}`;
    const response = await fetch(provider, { next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: "Exchange rates are temporarily unavailable." }, { status: 502 });
    const payload = await response.json() as { date?: string; rates?: Record<string, number> };
    const rates: Partial<Record<CurrencyCode, string>> = {};
    for (const symbol of targetSymbols) {
      const value = payload.rates?.[symbol];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) rates[symbol as CurrencyCode] = String(value);
    }
    if (Object.keys(rates).length !== targetSymbols.length) return NextResponse.json({ error: "The requested exchange rate is unavailable." }, { status: 502 });
    return NextResponse.json({ base, rates, date: payload.date ?? "", fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Exchange rates are temporarily unavailable." }, { status: 502 });
  }
}
