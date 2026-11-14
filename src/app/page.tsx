import Link from "next/link";
import { SplitzyMark } from "@/components/splitzy-mark";

const friends = [
  { initials: "J", color: "bg-[#f9b79f]" },
  { initials: "M", color: "bg-[#c7d6ff]" },
  { initials: "A", color: "bg-[#f8d67c]" },
  { initials: "+", color: "bg-[#e6e1d8]" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaf7] text-[#25251f]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" aria-label="Splitzy home" className="flex items-center gap-2.5">
          <SplitzyMark />
          <span className="text-[1.35rem] font-extrabold tracking-[-0.06em]">splitzy</span>
        </Link>
        <span className="hidden rounded-full border border-[#e9e6df] px-4 py-2 text-xs font-semibold text-[#77766d] sm:block">
          LESS MATH, MORE MEMORIES
        </span>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-16">
        <div className="relative z-10">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-[#f1efe8] px-3.5 py-2 text-xs font-semibold text-[#626157]">
            <span className="h-2 w-2 rounded-full bg-[#93a77c]" />
            THE EASY WAY TO SPLIT UP
          </div>
          <h1 className="max-w-xl text-[3.5rem] font-extrabold leading-[0.98] tracking-[-0.075em] sm:text-7xl lg:text-[5.25rem]">
            Good times.
            <br />
            <span className="font-serif font-medium italic tracking-[-0.08em] text-[#ed795d]">Fair shares.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-[#77766d] sm:text-xl">
            Scan. Split. Settle. Keep the night about your friends, not the bill.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/groups"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#ed795d] px-7 text-base font-bold text-white shadow-[0_10px_24px_rgba(237,121,93,0.22)] transition hover:-translate-y-0.5 hover:bg-[#e86b4e] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ed795d]"
            >
              Create Group <span aria-hidden="true" className="text-xl">↗</span>
            </Link>
            <span className="text-sm text-[#929087]">No spreadsheets. No awkward math.</span>
          </div>
          <div className="mt-11 flex items-center gap-3">
            <div className="flex -space-x-2.5" aria-hidden="true">
              {friends.map((friend, index) => (
                <span key={index} className={`grid h-9 w-9 place-items-center rounded-full border-[3px] border-[#fbfaf7] text-xs font-bold text-[#514f48] ${friend.color}`}>
                  {friend.initials}
                </span>
              ))}
            </div>
            <p className="text-sm font-medium text-[#77766d]">Better together, down to the last bite.</p>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[440px] lg:ml-auto">
          <div className="absolute -right-6 -top-8 h-28 w-28 rounded-full bg-[#f5d77e]/50 blur-2xl sm:-right-10 sm:-top-10 sm:h-40 sm:w-40" />
          <div className="absolute -bottom-8 -left-6 h-32 w-32 rounded-full bg-[#eab09c]/40 blur-2xl sm:-left-10 sm:h-44 sm:w-44" />
          <div className="relative rotate-[1.5deg] rounded-[2rem] border border-[#ebe7de] bg-white p-5 shadow-[0_28px_80px_rgba(76,67,51,0.12)] sm:p-7">
            <div className="flex items-center justify-between border-b border-dashed border-[#eae7df] pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#a19e93]">TONIGHT&apos;S TABLE</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Dinner crew</h2>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f7efe9] text-lg" aria-hidden="true">✳</span>
            </div>
            <div className="space-y-4 py-5">
              <ReceiptLine icon="🥑" name="Avocado toast" detail="Maya · sourdough" price="$14.00" />
              <ReceiptLine icon="🍝" name="Sunday pasta" detail="Jules · extra parm" price="$22.00" />
              <ReceiptLine icon="🍋" name="House lemonade" detail="Alex · one glass" price="$6.00" />
            </div>
            <div className="rounded-2xl bg-[#f7f6f1] p-4">
              <div className="flex justify-between text-sm text-[#77766d]"><span>Subtotal</span><span>$42.00</span></div>
              <div className="mt-2 flex justify-between text-sm text-[#77766d]"><span>Tax &amp; tip</span><span>$8.40</span></div>
              <div className="my-3 border-t border-dashed border-[#dedbd1]" />
              <div className="flex items-baseline justify-between"><span className="font-bold">Each pays</span><strong className="text-2xl font-extrabold tracking-tight">$16.80</strong></div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="flex -space-x-2" aria-label="Three friends in the group">
                {friends.slice(0, 3).map((friend, index) => <span key={index} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-white text-[10px] font-bold ${friend.color}`}>{friend.initials}</span>)}
              </div>
              <span className="rounded-full bg-[#edf1e8] px-3 py-1.5 text-xs font-bold text-[#687957]">All settled ✓</span>
            </div>
          </div>
          <div className="absolute -right-2 top-[42%] rotate-6 rounded-2xl bg-[#f4d578] px-4 py-3 text-sm font-extrabold shadow-lg sm:-right-8">
            Nice &amp; easy <span aria-hidden="true">☺</span>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-[#eeeae2] px-5 py-6 text-xs font-medium text-[#a19e93] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>Made for the moments worth splitting.</span>
        <span>Splitzy · Scan. Split. Settle.</span>
      </footer>
    </main>
  );
}

function ReceiptLine({ icon, name, detail, price }: { icon: string; name: string; detail: string; price: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f6f2e9] text-xl" aria-hidden="true">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="mt-0.5 truncate text-xs text-[#99968d]">{detail}</p>
      </div>
      <span className="text-sm font-bold">{price}</span>
    </div>
  );
}
