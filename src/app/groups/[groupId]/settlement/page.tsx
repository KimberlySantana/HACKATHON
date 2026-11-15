import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SettlementSummary } from "@/components/expenses/settlement-summary";

export default function SettlementPage({ params }: { params: Promise<{ groupId: string }> }) {
  return <AppShell title="Settlement" description="Review balances and settle up with your group." active="groups" action={<Link href="/groups" className="brand-button brand-button-cream text-sm"><ArrowRight size={15} className="rotate-180" aria-hidden="true" />Groups</Link>}><Suspense fallback={<p role="status" className="brand-card p-5 text-sm text-muted">Loading settlement…</p>}><SettlementContent params={params} /></Suspense></AppShell>;
}

async function SettlementContent({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <SettlementSummary groupId={groupId} />;
}
