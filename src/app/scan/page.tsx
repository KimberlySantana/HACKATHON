"use client";

import Link from "next/link";
import { ArrowLeft, Home, ScanLine, UsersRound } from "lucide-react";
import { SplitzyMark } from "@/components/splitzy-mark";
import { LanguageSwitcher, useLanguage } from "@/components/i18n";
import { CurrencySwitcher } from "@/components/currency";
import ScanWorkspace from "./scan-workspace";

export default function ScanPage() {
  const { t } = useLanguage();

  return (
    <main className="brand-page scan-page min-h-screen overflow-hidden text-foreground">
      <header className="brand-shell-header relative z-10 mx-auto flex flex-wrap items-center gap-3 px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" aria-label={t("navigation.homeAria")} className="group flex items-center gap-2.5">
          <SplitzyMark />
          <span className="text-[1.35rem] font-extrabold tracking-[-0.06em] transition group-hover:text-primary">splitzy</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          <Link href="/" className="brand-nav-link flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-muted hover:bg-accent-soft hover:text-foreground"><Home size={16} aria-hidden="true" />Overview</Link>
          <Link href="/groups" className="brand-nav-link flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-muted hover:bg-accent-soft hover:text-foreground"><UsersRound size={16} aria-hidden="true" />Groups</Link>
          <Link href="/scan" aria-current="page" data-active="true" className="brand-nav-link flex min-h-10 items-center gap-2 px-3 text-sm font-bold text-primary"><ScanLine size={16} aria-hidden="true" />Scan receipt</Link>
        </nav>
        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <Link href="/" className="brand-back-link">
            <ArrowLeft size={16} aria-hidden="true" />{t("navigation.backHome")}
          </Link>
          <LanguageSwitcher /><CurrencySwitcher />
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-8 sm:px-8 sm:pt-14 lg:pb-16">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#dfe8f5]/60 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-28 top-56 h-56 w-56 rounded-full bg-[#dcefea]/60 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl scan-fade-in">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ead8ce] bg-[#fff8f4] px-3.5 py-2 text-[11px] font-extrabold tracking-[0.16em] text-[#a45c4b] shadow-[0_8px_20px_rgba(177,104,78,0.08)]">
            <span className="h-2 w-2 rounded-full bg-[#ed795d] shadow-[0_0_0_4px_rgba(237,121,93,0.14)]" />
            {t("scan.badge")}
          </div>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[0.94] tracking-[-0.075em] sm:text-7xl">
            {t("scan.heroTitleIn")}
            <br />
            <span className="font-medium text-primary">{t("scan.heroTitleOut")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#77766d] sm:text-lg sm:leading-8">
            {t("scan.heroDescription")}
          </p>
        </div>

        <ScanWorkspace />
      </section>
      <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-border bg-white/95 px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(31,50,77,0.1)] backdrop-blur lg:hidden">
        <Link href="/" className="brand-nav-link flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-extrabold text-muted"><Home size={19} aria-hidden="true" /><span>Overview</span></Link>
        <Link href="/groups" className="brand-nav-link flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-extrabold text-muted"><UsersRound size={19} aria-hidden="true" /><span>Groups</span></Link>
        <Link href="/scan" aria-current="page" data-active="true" className="brand-nav-link flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-extrabold text-primary"><ScanLine size={19} aria-hidden="true" /><span>Scan receipt</span></Link>
      </nav>
    </main>
  );
}
