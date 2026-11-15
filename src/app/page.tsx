import Link from "next/link";
import { ArrowRight, Plus, UsersRound } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GroupList } from "@/components/groups/group-list";
import { Card } from "@/components/ui/card";

export default function Home() {
  return <AppShell title="Overview" description="Your groups and shared expenses, in one place." active="overview" action={<Link href="/groups" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><Plus size={15} aria-hidden="true" />Create group</Link>}>
    <div className="space-y-7 sm:space-y-9">
      <section aria-labelledby="welcome-title" className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-primary">SHARED EXPENSES, MADE CLEAR</p>
          <h2 id="welcome-title" className="mt-3 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">Good company. Clear totals.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Create a group, enter shared items, and review each person’s calculated share before settling up.</p>
        </div>
        <Link href="/groups" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"><UsersRound size={16} aria-hidden="true" />View groups<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>

      <section aria-label="Your groups"><GroupList /></section>

      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#87928b]">GET STARTED</p>
        <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em]">A clear split starts with the receipt.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Create a group, add its members, then enter the receipt items manually. Splitzy calculates item shares, tax, tip, and suggested transfers from the information you provide.</p>
        <p className="mt-3 text-xs leading-5 text-muted">Receipt scanning is not available yet. No payment is sent or marked complete by Splitzy.</p>
        <Link href="/groups" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface-muted">Create your first group<ArrowRight size={15} aria-hidden="true" /></Link>
      </Card>
    </div>
  </AppShell>;
}
