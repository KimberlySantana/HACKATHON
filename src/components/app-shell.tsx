import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Home, ScanLine, Settings2, UsersRound } from "lucide-react";
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
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-border bg-white/80 px-5 py-6 backdrop-blur lg:flex">
        <Link href="/" aria-label="Splitzy overview" className="flex items-center gap-3 px-2">
          <SplitzyMark />
          <span className="text-[1.2rem] font-extrabold tracking-[-0.055em]">splitzy</span>
        </Link>
        <div className="relative mt-10 overflow-hidden rounded-2xl border border-[#dfe7ef] bg-[#f3f6fb] p-4">
          <Image src="/mascots/pip-receipt.png" alt="" width={116} height={106} className="mascot-bob absolute right-3 top-3 h-14 w-14 object-contain opacity-90" aria-hidden="true" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm"><UsersRound size={17} aria-hidden="true" /></div>
          <p className="relative mt-3 text-sm font-extrabold">Better together</p>
          <p className="relative mt-1 text-xs leading-5 text-muted">Keep shared costs clear, so the good parts stay the focus.</p>
          <Link href="/groups" className="relative mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-primary hover:underline">View your groups <ArrowUpRight size={13} aria-hidden="true" /></Link>
        </div>
        <div className="mt-auto border-t border-border pt-5">
          <div className="mb-3 flex items-center gap-2 px-1"><Settings2 size={14} className="text-muted" aria-hidden="true" /><p className="brand-kicker">Preferences</p></div>
          <div className="space-y-2"><LanguageSwitcher /><CurrencySwitcher /></div>
        </div>
        <div className="mt-5 border-t border-border px-2 pt-4 text-[11px] text-muted">Splitzy · Scan. Split. Settle.</div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="brand-shell-header sticky top-0 z-30 px-4 py-3 sm:px-7 sm:py-4 lg:px-10">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" aria-label="Splitzy overview" className="lg:hidden"><SplitzyMark /></Link>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-extrabold tracking-[-0.035em] sm:text-[1.35rem]">{title}</h1>
                {description && <p className="mt-0.5 hidden text-sm text-muted sm:block">{description}</p>}
              </div>
            </div>
            <nav aria-label="Main navigation" className="order-3 hidden w-full items-center gap-1 border-t border-border pt-3 md:flex lg:order-2 lg:w-auto lg:border-0 lg:pt-0">
              {navigation.map(({ href, label, key, Icon }) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} data-active={active === key} className={cn("brand-nav-link flex min-h-10 items-center gap-2 px-3 text-sm font-bold", active === key ? "text-primary" : "text-muted hover:bg-accent-soft hover:text-foreground")}><Icon size={16} strokeWidth={1.9} aria-hidden="true" /><span>{label}</span>{key === "scan" && <ArrowUpRight size={13} className="text-muted" aria-hidden="true" />}</Link>)}
            </nav>
            <div className="order-2 ml-auto flex items-center gap-2 sm:gap-3 lg:order-3">
              {action}
            </div>
            <div className="order-4 basis-full border-t border-border pt-3 lg:order-3 lg:basis-auto lg:border-0 lg:pt-0">
              <AuthPanel />
            </div>
          </div>
          <div className="mx-auto mt-3 flex max-w-[1200px] flex-wrap items-center gap-2 border-t border-border pt-3 lg:hidden"><LanguageSwitcher /><CurrencySwitcher /></div>
        </header>
        <main className="mx-auto w-full max-w-[1200px] px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-6 sm:px-7 sm:pt-8 lg:px-10 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-white/95 px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(31,50,77,0.1)] backdrop-blur lg:hidden">
      {navigation.map(({ href, label, key, Icon }) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} data-active={active === key} className={cn("brand-nav-link flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-extrabold", active === key ? "text-[#a45c4b]" : "text-muted")}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
  </div>;
}
