"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { mockReceipt } from "@/lib/receipt/mock";

export function DemoScanner() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  function previewPhoto(file?: File) {
    setPhotoUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : null;
    });
    setShowSample(false);
  }

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
    <section className="rounded-2xl border border-border bg-white p-5 sm:p-6" aria-labelledby="upload-title">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-primary">Receipt preview</p>
          <h2 id="upload-title" className="mt-2 text-xl font-semibold">Choose a receipt photo</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Your image is previewed in this browser only. Receipt reading is turned off for this demo.</p>
        </div>
        <Image src="/mascots/pip-receipt.png" alt="Pip the Splitzy receipt mascot" width={88} height={88} className="h-20 w-20 shrink-0 object-contain" priority />
      </div>
      <label htmlFor="receipt-photo" className="mt-5 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-muted px-4 text-sm font-semibold text-foreground hover:bg-[#e8eee9]">
        Select photo
      </label>
      <input id="receipt-photo" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => previewPhoto(event.target.files?.[0])} />
      {photoUrl && <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface-muted p-2">
        {/* The browser-created object URL is local and is revoked when replaced or the page unmounts. */}
        <img src={photoUrl} alt="Preview of the selected receipt photo" className="mx-auto max-h-[420px] w-auto rounded-lg object-contain" />
        <p className="px-2 pb-1 pt-3 text-center text-xs font-medium text-muted">Photo preview only · no items were extracted</p>
      </div>}
      <button type="button" onClick={() => { previewPhoto(); setShowSample(true); }} className="mt-4 min-h-11 w-full rounded-xl border border-primary/20 px-4 text-sm font-semibold text-primary hover:bg-[#eaf1ec]">Try the sample receipt</button>
      <p className="mt-3 text-xs leading-5 text-muted">The sample is prepared demo data. It is not AI output and does not come from your photo.</p>
    </section>

    <section className="rounded-2xl border border-border bg-white p-5 sm:p-6" aria-labelledby="sample-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-primary">Sample scanner</p>
          <h2 id="sample-title" className="mt-2 text-xl font-semibold">{showSample ? mockReceipt.merchant : "See how a receipt split looks"}</h2>
        </div>
        {showSample && <span className="rounded-full bg-[#fff4df] px-3 py-1.5 text-xs font-bold text-[#8a5b19]">DEMO DATA</span>}
      </div>
      {showSample ? <>
        <p className="mt-2 text-sm text-muted">Example items · {mockReceipt.date}</p>
        <ul className="mt-5 divide-y divide-border" aria-label="Sample receipt items">
          {mockReceipt.items.map((item) => <li key={item.id} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{item.name}</span><span className="font-semibold">${item.total.toFixed(2)}</span></li>)}
        </ul>
        <dl className="mt-3 space-y-2 rounded-xl bg-surface-muted p-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>${mockReceipt.subtotal.toFixed(2)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd>${mockReceipt.tax.toFixed(2)}</dd></div>
          <div className="flex justify-between"><dt>Tip</dt><dd>${mockReceipt.tip.toFixed(2)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 font-bold"><dt>Total</dt><dd>${mockReceipt.total.toFixed(2)}</dd></div>
        </dl>
      </> : <div className="mt-5 grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-surface-muted p-6 text-center">
        <div><p className="font-medium">Sample results appear here</p><p className="mt-1 text-sm text-muted">Use the button to view the prepared receipt and its item totals.</p></div>
      </div>}
      <Link href="/groups" className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">Continue with a group and enter items</Link>
    </section>
  </div>;
}
