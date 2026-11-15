import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-[0_8px_18px_rgba(49,76,112,0.16)]",
  secondary: "bg-mint text-foreground hover:bg-[#d9eee7]",
  outline: "border border-border bg-white text-foreground hover:border-accent hover:bg-accent-soft",
  ghost: "text-muted hover:bg-accent-soft hover:text-primary",
  danger: "bg-danger text-white hover:bg-[#8f3734]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
  icon: "h-10 w-10 p-0",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-xl font-bold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
