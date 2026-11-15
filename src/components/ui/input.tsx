import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("brand-input text-sm placeholder:text-[#607089] disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60", className)} {...props} />;
}
