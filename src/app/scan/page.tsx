import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export default function ScanPage() {
  return <AppShell title="Receipt scanning" description="AI receipt scanning is coming later." active="groups">
    <section className="max-w-xl rounded-2xl border border-border bg-white p-6 sm:p-8">
      <h2 className="text-xl font-semibold">Add expenses manually for now</h2>
      <p className="mt-3 text-sm leading-6 text-muted">Create a group, enter each item, and assign who shares it. Splitzy calculates tax, tip, balances, and suggested settlements.</p>
      <Link href="/groups" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Go to groups</Link>
    </section>
  </AppShell>;
}
