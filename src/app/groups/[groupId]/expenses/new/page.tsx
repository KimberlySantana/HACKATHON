import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default function NewExpensePage({ params }: { params: Promise<{ groupId: string }> }) {
  return <AppShell title="Add expense" description="Enter what was shared and review every part of the total." active="groups">
    <Suspense fallback={<div role="status" className="animate-pulse rounded-2xl border border-border bg-white p-6"><span className="block h-4 w-24 rounded bg-surface-muted" /><span className="mt-4 block h-8 w-1/2 rounded bg-surface-muted" /><span className="mt-7 block h-24 rounded-xl bg-surface-muted" /></div>}><NewExpenseContent params={params} /></Suspense>
  </AppShell>;
}

async function NewExpenseContent({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <ExpenseForm groupId={groupId} />;
}
