import { AlertCircle } from "lucide-react";

export function FormErrorToast({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return <div id={id} role="alert" aria-live="assertive" className="fixed inset-x-4 bottom-4 z-[100] mx-auto flex max-w-lg items-start gap-2 rounded-xl border border-[#e8b1a5] bg-[#fff1ee] px-4 py-3 text-sm font-medium leading-5 text-[#a64531] shadow-lg sm:bottom-6">
    <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
    <span>{message}</span>
  </div>;
}
