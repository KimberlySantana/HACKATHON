import Link from "next/link";
import { Suspense } from "react";

export default function ScanPage({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  return <Suspense fallback={<main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-8 sm:px-8"><p role="status" className="my-auto text-sm text-[#77766d]">Loading receipt scanner status…</p></main>}><ScanContent searchParams={searchParams} /></Suspense>;
}

async function ScanContent({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  const { groupId } = await searchParams;
  const manualExpenseHref = groupId ? `/groups/${encodeURIComponent(groupId)}/expenses/new` : "/groups";

  return <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-8 sm:px-8">
    <Link href={groupId ? `/groups/${encodeURIComponent(groupId)}` : "/"} className="text-sm font-semibold text-primary">← {groupId ? "Back to group" : "Back to overview"}</Link>
    <section className="my-auto py-16" aria-labelledby="scanner-title">
      <p className="text-xs font-bold tracking-[0.16em] text-[#99968d]">RECEIPT SCANNER</p>
      <h1 id="scanner-title" className="mt-3 text-3xl font-bold tracking-tight">Receipt scanning isn’t available yet.</h1>
      <p className="mt-4 leading-7 text-[#77766d]">The AI scanner is being integrated separately. No receipt has been uploaded or processed. You can enter the items yourself and review every share before saving.</p>
      <Link href={manualExpenseHref} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-primary-hover">{groupId ? "Enter items manually" : "Choose a group"}</Link>
    </section>
  </main>;
}
