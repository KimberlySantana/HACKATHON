"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, ReceiptText, UsersRound } from "lucide-react";
import { LanguageSwitcher, useLanguage } from "@/components/i18n";
import { AppShell } from "@/components/app-shell";
import { GroupList } from "@/components/groups/group-list";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const friends = [
  { initials: "J", color: "bg-[#f9b79f]" },
  { initials: "M", color: "bg-[#c7d6ff]" },
  { initials: "A", color: "bg-[#f8d67c]" },
  { initials: "+", color: "bg-[#e6e1d8]" },
];

const exampleActivity = [
  { title: "Dinner at Paloma", detail: "Maya paid · 3 people", amount: "$18.50", direction: "owe" as const, initials: "M", tone: "bg-[#f8ebe6] text-[#965641]" },
  { title: "Weekly groceries", detail: "You paid · 2 people", amount: "$24.00", direction: "owed" as const, initials: "Y", tone: "bg-[#eaf1ec] text-[#315d45]" },
  { title: "Cab to the coast", detail: "Jordan paid · 4 people", amount: "$9.25", direction: "owe" as const, initials: "J", tone: "bg-[#edf0f7] text-[#526184]" },
];

export default function Home() {
  const { t } = useLanguage();

  return (
    <AppShell
      title="Overview"
      description="A clear view of the shared costs you’re keeping track of."
      active="overview"
      action={
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link href="/groups" className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-white hover:bg-primary-hover">
            <Plus size={15} aria-hidden="true" />{t("home.createGroup")}
          </Link>
        </div>
      }
    >
      <div className="space-y-7 sm:space-y-9">
        <section className="relative grid items-center gap-8 overflow-hidden rounded-2xl border border-[#ead8ce] bg-[#fff8f4] p-5 shadow-[0_20px_60px_rgba(177,104,78,0.08)] sm:p-7 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <div className="relative z-10 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#f1efe8] px-3.5 py-2 text-xs font-semibold text-[#626157]">
              <span className="h-2 w-2 rounded-full bg-[#93a77c]" />{t("home.badge")}
            </div>
            <h2 className="max-w-xl text-[3rem] font-extrabold leading-[0.98] tracking-[-0.075em] sm:text-6xl">
              {t("home.titleGoodTimes")}<br />
              <span className="font-serif font-medium italic tracking-[-0.08em] text-[#ed795d]">{t("home.titleFairShares")}</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-[#77766d] sm:text-lg">{t("home.description")}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/groups" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-[#ed795d] px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgba(237,121,93,0.22)] transition hover:-translate-y-0.5 hover:bg-[#e86b4e]">
                {t("home.createGroup")} <span aria-hidden="true" className="text-xl">↗</span>
              </Link>
              <Link href="/scan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#ead8ce] bg-white px-5 text-sm font-bold text-[#8b5f52] transition hover:-translate-y-0.5 hover:border-[#ed795d]">
                {t("scan.badge")} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mt-5 text-sm text-[#929087]">{t("home.helper")}</p>
          </div>

          <div className="relative mx-auto w-full max-w-[420px] lg:ml-auto">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#f5d77e]/50 blur-2xl" />
            <div className="absolute -bottom-8 -left-8 h-36 w-36 rounded-full bg-[#eab09c]/40 blur-2xl" />
            <Image src="/mascots/pip-receipt.png" alt="" width={260} height={238} className="mascot-bob absolute -right-1 -top-20 z-20 h-auto w-32 drop-shadow-[0_18px_20px_rgba(111,77,65,0.18)] sm:-right-3 sm:-top-24 sm:w-40" priority />
            <div className="relative rotate-[1.5deg] rounded-[2rem] border border-[#ebe7de] bg-white p-5 shadow-[0_28px_80px_rgba(76,67,51,0.12)] sm:p-6">
              <div className="flex items-center justify-between border-b border-dashed border-[#eae7df] pb-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a19e93]">{t("home.tableLabel")}</p><h3 className="mt-1 text-xl font-bold tracking-tight">{t("home.dinnerCrew")}</h3></div>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f7efe9] text-lg" aria-hidden="true">✳</span>
              </div>
              <div className="space-y-4 py-5">
                <ReceiptLine icon="🥑" name="Avocado toast" detail="Maya · sourdough" price="$14.00" />
                <ReceiptLine icon="🍝" name="Sunday pasta" detail="Jules · extra parm" price="$22.00" />
                <ReceiptLine icon="🍋" name="House lemonade" detail="Alex · one glass" price="$6.00" />
              </div>
              <div className="rounded-2xl bg-[#f7f6f1] p-4">
                <div className="flex justify-between text-sm text-[#77766d]"><span>{t("home.subtotal")}</span><span>$42.00</span></div>
                <div className="mt-2 flex justify-between text-sm text-[#77766d]"><span>{t("home.taxTip")}</span><span>$8.40</span></div>
                <div className="my-3 border-t border-dashed border-[#dedbd1]" />
                <div className="flex items-baseline justify-between"><span className="font-bold">{t("home.eachPays")}</span><strong className="text-2xl font-extrabold tracking-tight">$16.80</strong></div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex -space-x-2" aria-label={t("home.threeFriendsAria")}>
                  {friends.slice(0, 3).map((friend, index) => <span key={index} className={"grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-bold " + friend.color}>{friend.initials}</span>)}
                </div>
                <span className="rounded-full bg-[#edf1e8] px-3 py-1.5 text-xs font-bold text-[#687957]">{t("home.allSettled")}</span>
              </div>
            </div>
            <div className="relative -mt-1 flex items-center justify-between rounded-b-[2rem] border-x border-b border-[#ebe7de] bg-white/80 px-5 py-3">
              <span className="text-xs font-bold text-[#9a8176]">{t("home.everyTable")}</span>
              <Image src="/mascots/friends-lineup.png" alt="" width={434} height={145} className="h-9 w-28 object-contain object-right" />
            </div>
          </div>
        </section>

        <section aria-labelledby="welcome-title" className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-white p-5 sm:flex-row sm:items-center sm:p-7">
          <div className="max-w-2xl">
            <Badge tone="green"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />SHARED EXPENSES, MADE CLEAR</Badge>
            <h2 id="welcome-title" className="mt-3 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">Good company. Clear totals.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Keep the bill fair without the awkward follow-up. Create a group, add what you shared, and see the math before anyone settles up.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href="/scan" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-surface-muted"><ReceiptText size={16} aria-hidden="true" />Scan receipt</Link>
            <Link href="/groups" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface-muted px-4 text-sm font-semibold text-foreground hover:bg-[#e8eee9]"><UsersRound size={16} aria-hidden="true" />View groups</Link>
          </div>
        </section>

        <section aria-labelledby="example-summary-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#87928b]">AT A GLANCE</p><h2 id="example-summary-title" className="mt-1 text-lg font-semibold tracking-[-0.025em]">Example balances</h2></div><Badge tone="amber">Example data · not your totals</Badge></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="You owe" amount="$27.75" detail="Across 2 example groups" direction="owe" />
            <SummaryCard label="Owed to you" amount="$24.00" detail="Across 1 example group" direction="owed" />
            <Card className="p-4 sm:p-5"><p className="text-sm font-medium text-muted">Example shared spend</p><p className="mt-2 text-2xl font-semibold tracking-[-0.045em]">$86.50</p><p className="mt-1 text-xs text-[#87928b]">Illustrative only · no live totals</p></Card>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf1ed] px-5 py-4 sm:px-6"><div><h2 className="text-base font-semibold">Recent activity</h2><p className="mt-0.5 text-xs text-muted">A sample of how shared expenses appear</p></div><Badge>Example</Badge></div>
            <ul className="divide-y divide-[#edf1ed]">
              {exampleActivity.map((entry) => <li key={entry.title} className="flex items-center gap-3 px-5 py-4 sm:px-6"><span className={"grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold " + entry.tone}>{entry.initials}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{entry.title}</p><p className="mt-0.5 text-xs text-muted">{entry.detail}</p></div><div className="text-right"><p className={"text-sm font-semibold " + (entry.direction === "owed" ? "text-success" : "text-foreground")}>{entry.direction === "owed" ? "+" : "−"}{entry.amount}</p><p className="mt-0.5 text-[11px] text-muted">{entry.direction === "owed" ? "your share back" : "your share"}</p></div></li>)}
            </ul>
            <div className="flex items-start gap-2 border-t border-[#edf1ed] bg-[#fbfcfa] px-5 py-3 text-xs leading-5 text-muted sm:px-6"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c79d50]" />Example entries are illustrative. Your real balances appear inside each group’s settlement.</div>
          </Card>
          <Card className="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#87928b]">GET STARTED</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-0.025em]">Keep everyone on the same page.</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Groups keep people, item splits, and settlement details together.</p>
            <div className="mt-5 space-y-3"><Step number="1" title="Create a group" detail="Add the people sharing the cost." /><Step number="2" title="Add an expense" detail="Scan a receipt or enter items by hand." /><Step number="3" title="Review the split" detail="Check item shares, tax, and tip." /></div>
            <Link href="/groups" className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">Create your first group <ArrowRight size={16} aria-hidden="true" /></Link>
          </Card>
        </section>

        <section aria-label="Your real groups"><GroupList /></section>
      </div>
    </AppShell>
  );
}

function ReceiptLine({ icon, name, detail, price }: { icon: string; name: string; detail: string; price: string }) {
  return <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f6f2e9] text-xl" aria-hidden="true">{icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{name}</p><p className="mt-0.5 truncate text-xs text-[#99968d]">{detail}</p></div><span className="text-sm font-bold">{price}</span></div>;
}

function SummaryCard({ label, amount, detail, direction }: { label: string; amount: string; detail: string; direction: "owe" | "owed" }) {
  const Icon = direction === "owe" ? ArrowUpRight : ArrowDownLeft;
  const tone = direction === "owed" ? "grid h-8 w-8 place-items-center rounded-lg bg-success-soft text-success" : "grid h-8 w-8 place-items-center rounded-lg bg-surface-muted text-muted";
  return <Card className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-muted">{label}</p><span className={tone}><Icon size={16} aria-hidden="true" /></span></div><p className="mt-2 text-2xl font-semibold tracking-[-0.045em]">{amount}</p><p className="mt-1 text-xs text-[#87928b]">{detail}</p></Card>;
}

function Step({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#eaf1ec] text-xs font-semibold text-primary">{number}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-5 text-muted">{detail}</p></div></div>;
}
