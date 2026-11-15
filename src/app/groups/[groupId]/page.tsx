import Link from "next/link";
import { Suspense } from "react";
import { ScanLine } from "lucide-react";
import { GroupForm } from "@/components/groups/group-form";
import { SplitzyMark } from "@/components/splitzy-mark";
import { GroupExpenseOverview } from "@/components/expenses/group-expense-overview";
import { GroupMembersPanel } from "@/components/groups/group-members-panel";
import { groupExpenseHref, groupScannerHref } from "@/lib/groups/form";

export default function GroupDetailPage({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ created?: string; updated?: string }> }) {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#25251f]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Splitzy home">
          <SplitzyMark />
          <span className="text-[1.35rem] font-extrabold tracking-[-0.06em]">splitzy</span>
        </Link>
        <Link href="/" className="text-sm font-bold text-[#77766d] hover:text-[#d9674b]">Home</Link>
      </header>
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-4 sm:px-8">
        <Link href="/groups" className="mb-5 inline-flex text-sm font-semibold text-[#d9674b] hover:text-[#bb4f36]">← All groups</Link>
        <Suspense fallback={<p role="status" className="rounded-2xl border border-[#ebe7de] bg-white p-5 text-sm text-[#77766d]">Loading group…</p>}>
          <GroupDetail params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function GroupDetail({ params, searchParams }: { params: Promise<{ groupId: string }>; searchParams: Promise<{ created?: string; updated?: string }> }) {
  const [{ groupId }, query] = await Promise.all([params, searchParams]);
  const encodedId = encodeURIComponent(groupId);
  return <div className="space-y-5">
    {query.created === "1" && <p role="status" className="rounded-xl border border-[#cfe0d3] bg-[#f1f7f2] px-4 py-3 text-sm font-medium leading-5 text-primary">Group created. Add members when you’re ready, then record your first shared expense.</p>}
    {query.updated === "1" && <p role="status" className="rounded-xl border border-[#cfe0d3] bg-[#f1f7f2] px-4 py-3 text-sm font-medium leading-5 text-primary">Group details saved.</p>}
    <section aria-labelledby="first-expense-title" className="rounded-2xl border border-[#dce7de] bg-white p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">NEXT STEP</p><h2 id="first-expense-title" className="mt-1 text-lg font-semibold">Start with a shared expense</h2><p className="mt-1 text-sm leading-5 text-muted">Add the people sharing this plan, then enter the items yourself and review the split before saving.</p></div>
        <div className="flex flex-wrap gap-2">
          <Link href={groupScannerHref(groupId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface-muted"><ScanLine size={15} aria-hidden="true" />Scan Receipt</Link>
          <Link href={groupExpenseHref(groupId)} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Add manually</Link>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-[#f7f6f1] px-3.5 py-2.5 text-xs leading-5 text-muted">Review every extracted amount, then choose who paid and assign items before saving.</p>
    </section>
    <GroupMembersPanel groupId={groupId} />
    <div className="flex justify-end"><Link href={`/groups/${encodedId}/settlement`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface-muted">View settlement</Link></div>
    <GroupExpenseOverview groupId={groupId} />
    <GroupForm groupId={groupId} />
  </div>;
}
