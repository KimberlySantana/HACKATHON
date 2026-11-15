"use client";

import { useLanguage } from "@/components/i18n";

export default function ScanIntro() {
  const { t } = useLanguage();
  return <div className="scan-fade-in mb-6 max-w-3xl">
    <p className="text-xs font-semibold uppercase tracking-[0.11em] text-primary">{t("scan.badge")}</p>
    <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">{t("scan.heroTitleIn")} {t("scan.heroTitleOut")}</h2>
    <p className="mt-3 text-sm leading-6 text-muted">{t("scan.heroDescription")}</p>
  </div>;
}
