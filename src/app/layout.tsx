import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/groups/auth-provider";
import { LanguageProvider } from "@/components/i18n";

export const metadata: Metadata = {
  title: "Splitzy — Scan. Split. Settle.",
  description: "Split the bill fairly and get back to the good times with Splitzy.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full"><AuthProvider><LanguageProvider>{children}</LanguageProvider></AuthProvider></body></html>;
}
