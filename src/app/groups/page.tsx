import Link from "next/link";

export default function GroupsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-5 py-8 sm:px-8">
      <Link href="/" className="text-sm font-semibold text-[#ed795d]">← Back to Splitzy</Link>
      <div className="my-auto py-16">
        <p className="text-xs font-bold tracking-[0.16em] text-[#99968d]">GROUPS</p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight">Your group starts here.</h1>
        <p className="mt-4 leading-7 text-[#77766d]">Group creation is ready for the frontend feature branch. Add your group form and member list here.</p>
      </div>
    </main>
  );
}
