import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ReceiptText } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GroupForm } from "@/components/groups/group-form";
import { GroupExpenseOverview } from "@/components/expenses/group-expense-overview";

export default function GroupDetailPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <AppShell title="Group details" description="Keep the people, items, and totals together." active="groups" action={<Link href="/groups" className="brand-button brand-button-cream text-sm"><ArrowRight size={15} className="rotate-180" aria-hidden="true" />All groups</Link>}>
    <Suspense fallback={<p role="status" className="brand-card p-5 text-sm text-muted">Loading group…</p>}><GroupDetail params={params} /></Suspense>
  </AppShell>;
}

async function GroupDetail({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <div className="mx-auto max-w-3xl space-y-6"><div className="flex flex-wrap gap-3"><Link href={`/groups/${encodeURIComponent(groupId)}/expenses/new`} className="brand-button brand-button-coral"><ReceiptText size={16} aria-hidden="true" />Add expense</Link><Link href={`/groups/${encodeURIComponent(groupId)}/settlement`} className="brand-button brand-button-cream">Settlement</Link></div><GroupExpenseOverview groupId={groupId} /><GroupForm groupId={groupId} /></div>;
}
