import Link from "next/link";
import { SplitzyMark } from "@/components/splitzy-mark";
import ScanWorkspace from "./scan-workspace";

export default function ScanPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#25251f]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="Splitzy home" className="flex items-center gap-2.5">
          <SplitzyMark />
          <span className="text-[1.35rem] font-extrabold tracking-[-0.06em]">splitzy</span>
        </Link>
        <Link href="/" className="text-sm font-bold text-[#ed795d] transition hover:text-[#d95f45]">
          Back to home <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8 sm:pt-14">
        <div className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#f1efe8] px-3.5 py-2 text-xs font-bold tracking-[0.12em] text-[#77766d]">
            <span className="h-2 w-2 rounded-full bg-[#ed795d]" />
            RECEIPT SCANNER
          </div>
          <h1 className="text-5xl font-extrabold leading-[0.98] tracking-[-0.07em] sm:text-7xl">
            A receipt in.
            <br />
            <span className="font-serif font-medium italic text-[#ed795d]">Fair shares out.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#77766d]">
            Upload a photo, check the details, and get every item ready to split with your group.
          </p>
        </div>

        <ScanWorkspace />
      </section>
    </main>
  );
}
