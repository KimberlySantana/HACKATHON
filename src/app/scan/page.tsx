"use client";

import Link from "next/link";
import { SplitzyMark } from "@/components/splitzy-mark";
import { LanguageSwitcher, useLanguage } from "@/components/i18n";
import { CurrencySwitcher } from "@/components/currency";
import ScanWorkspace from "./scan-workspace";

export default function ScanPage() {
  const { t } = useLanguage();

  return (
    <main className="brand-page scan-page min-h-screen overflow-hidden text-[#25251f]">
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label={t("navigation.homeAria")} className="group flex items-center gap-2.5">
          <SplitzyMark />
          <span className="text-[1.35rem] font-extrabold tracking-[-0.06em] transition group-hover:text-[#ed795d]">splitzy</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/" className="group rounded-full px-3 py-2 text-sm font-bold text-[#ed795d] transition hover:bg-[#fff0eb] hover:text-[#d95f45]">
            {t("navigation.backHome")} <span aria-hidden="true" className="inline-block transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5">↗</span>
          </Link>
          <LanguageSwitcher /><CurrencySwitcher />
        </div>
      </header>

      <section className="relative mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        <div className="pointer-events-none absolute -right-24 top-0 h-72 w-72 rounded-full bg-[#f7d7c9]/45 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-28 top-56 h-56 w-56 rounded-full bg-[#dfe9d7]/50 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-3xl scan-fade-in">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ead8ce] bg-[#fff8f4] px-3.5 py-2 text-[11px] font-extrabold tracking-[0.16em] text-[#a45c4b] shadow-[0_8px_20px_rgba(177,104,78,0.08)]">
            <span className="h-2 w-2 rounded-full bg-[#ed795d] shadow-[0_0_0_4px_rgba(237,121,93,0.14)]" />
            {t("scan.badge")}
          </div>
          <h1 className="max-w-2xl text-5xl font-extrabold leading-[0.94] tracking-[-0.075em] sm:text-7xl">
            {t("scan.heroTitleIn")}
            <br />
            <span className="font-serif font-medium italic text-[#ed795d] drop-shadow-[0_5px_0_rgba(237,121,93,0.08)]">{t("scan.heroTitleOut")}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#77766d] sm:text-lg sm:leading-8">
            {t("scan.heroDescription")}
          </p>
        </div>

        <ScanWorkspace />
      </section>
    </main>
  );
}
