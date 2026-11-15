import { AppShell } from "@/components/app-shell";
import { DemoScanner } from "@/app/scan/demo-scanner";

export default function ScanPage() {
  return <AppShell title="Receipt demo" description="Preview a photo or try the sample receipt. AI scanning is disabled." active="groups"><DemoScanner /></AppShell>;
}
