import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "green" | "amber" | "coral";
const tones: Record<BadgeTone, string> = {
  neutral: "bg-lavender text-[#6e617b]",
  green: "bg-mint text-success",
  amber: "bg-warning-soft text-warning",
  coral: "bg-accent-soft text-[#a4503b]",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return <span className={cn("inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-extrabold leading-none", tones[tone], className)} {...props} />;
}
