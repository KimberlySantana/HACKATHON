import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-[0_8px_18px_rgba(237,121,93,0.16)]",
  secondary: "bg-mint text-foreground hover:bg-[#d9eadc]",
  outline: "border border-[#ead8ce] bg-white text-foreground hover:border-accent hover:bg-[#fffaf7]",
  ghost: "text-muted hover:bg-accent-soft hover:text-[#a45c4b]",
  danger: "bg-danger text-white hover:bg-[#8d3b32]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-sm",
  icon: "h-10 w-10 p-0",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={cn("inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size], className)} {...props} />;
}
