import Link from "next/link";
import { Suspense } from "react";
import { Camera, ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default function NewExpensePage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams?: Promise<{ fromReceipt?: string | string[] }> }) {
  return <AppShell title="Add expense" description="Enter what was shared and review every part of the total." active="groups" action={<Link href="/scan" className="brand-button brand-button-cream min-h-10 text-sm"><Camera size={16} aria-hidden="true" /><span>Scan receipt</span></Link>}>
    <Suspense fallback={<div role="status" className="animate-pulse rounded-2xl border border-border bg-white p-6"><span className="block h-4 w-24 rounded bg-surface-muted" /><span className="mt-4 block h-8 w-1/2 rounded bg-surface-muted" /><span className="mt-7 block h-24 rounded-xl bg-surface-muted" /></div>}><NewExpenseContent params={params} searchParams={searchParams} /></Suspense>
  </AppShell>;
}

async function NewExpenseContent({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams?: Promise<{ fromReceipt?: string | string[] }> }) {
  const { groupId } = await params;
  const query = searchParams ? await searchParams : {};
  const fromReceipt = Array.isArray(query.fromReceipt) ? query.fromReceipt[0] : query.fromReceipt;
  return <><Link href={`/groups/${encodeURIComponent(groupId)}`} className="brand-back-link mb-4"><ChevronLeft size={16} aria-hidden="true" />Back to group</Link><ExpenseForm groupId={groupId} receiptId={fromReceipt} /></>;
}
