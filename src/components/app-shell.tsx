import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Home, ScanLine, UsersRound } from "lucide-react";
import { AuthPanel } from "@/components/groups/auth-panel";
import { LanguageSwitcher } from "@/components/i18n";
import { CurrencySwitcher } from "@/components/currency";
import { SplitzyMark } from "@/components/splitzy-mark";
import { cn } from "@/lib/utils";

type Destination = "overview" | "groups" | "scan";

const navigation: Array<{ href: string; label: string; key: Destination; Icon: typeof Home }> = [
  { href: "/", label: "Overview", key: "overview", Icon: Home },
  { href: "/groups", label: "Groups", key: "groups", Icon: UsersRound },
  { href: "/scan", label: "Scan receipt", key: "scan", Icon: ScanLine },
];

export function AppShell({ title, description, active, children, action }: { title: string; description?: string; active: Destination; children: ReactNode; action?: ReactNode }) {
  return <div className="brand-page text-foreground">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-[#eadfd8] bg-[#fffaf7]/90 px-5 py-6 backdrop-blur lg:flex">
        <Link href="/" aria-label="Splitzy overview" className="flex items-center gap-3 px-2">
          <SplitzyMark />
          <span className="text-[1.2rem] font-extrabold tracking-[-0.055em]">splitzy</span>
        </Link>
        <p className="brand-kicker mb-3 mt-10 px-3">Your space</p>
        <nav aria-label="Main navigation" className="space-y-1">
          {navigation.map(({ href, label, key, Icon }) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} data-active={active === key} className={cn("brand-nav-link flex min-h-11 items-center gap-3 px-3 text-sm font-bold", active === key ? "text-[#a45c4b]" : "text-muted hover:bg-accent-soft hover:text-foreground")}><Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{key === "scan" && <ArrowUpRight size={14} className="ml-auto text-[#b5a49b]" aria-hidden="true" />}</Link>)}
        </nav>
        <div className="relative mt-auto overflow-hidden rounded-[1.45rem] border border-[#ead8ce] bg-[#fff1eb] p-4">
          <Image src="/mascots/pip-receipt.png" alt="" width={116} height={106} className="absolute -right-3 -top-5 h-16 w-16 object-contain opacity-90" aria-hidden="true" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-[#a45c4b]"><UsersRound size={17} aria-hidden="true" /></div>
          <p className="relative mt-3 text-sm font-extrabold">Better together</p>
          <p className="relative mt-1 text-xs leading-5 text-muted">Keep shared costs clear, so the good parts stay the focus.</p>
          <Link href="/groups" className="relative mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-[#a45c4b] hover:underline">View your groups <ArrowUpRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className="mt-5 border-t border-[#eadfd8] px-2 pt-4 text-[11px] text-[#a19e93]">Splitzy · Scan. Split. Settle.</div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="brand-shell-header px-4 py-4 sm:px-7 sm:py-5 lg:px-10">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" aria-label="Splitzy overview" className="lg:hidden"><SplitzyMark /></Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-extrabold tracking-[-0.035em] sm:text-[1.35rem]">{title}</h1>
                {description && <p className="mt-0.5 hidden text-sm text-muted sm:block">{description}</p>}
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-end">
              <LanguageSwitcher /><CurrencySwitcher />
              {action}
              <AuthPanel />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-[#eadfd8] bg-[#fffaf7]/95 px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(112,82,68,0.08)] backdrop-blur lg:hidden">
      {navigation.map(({ href, label, key, Icon }) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} data-active={active === key} className={cn("brand-nav-link flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-extrabold", active === key ? "text-[#a45c4b]" : "text-muted")}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
  </div>;
}
