import { AppShell } from "@/components/app-shell";
import { LanguageSwitcher } from "@/components/i18n";
import ScanIntro from "./scan-intro";
import ScanWorkspace from "./scan-workspace";

export const instant = false;

export default async function ScanPage({ searchParams }: { searchParams: Promise<{ groupId?: string }> }) {
  const { groupId } = await searchParams;
  return <AppShell title="Scan receipt" description="Review the receipt, then assign every item before saving." active="scan" action={<LanguageSwitcher />}>
    <section className="scan-page rounded-2xl px-0 py-2 sm:px-1">
      <ScanIntro />
      <ScanWorkspace initialGroupId={groupId ?? ""} />
    </section>
  </AppShell>;
}
