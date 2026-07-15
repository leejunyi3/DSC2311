import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AppStateProvider } from "@/components/providers/AppStateProvider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Tuas Mega Port Resilience Control Tower",
  description:
    "Student prototype AI resilience monitor for Tuas Mega Port. Not official PSA/MPA data.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
    // attributes onto <html>/<body> before React hydrates. This suppresses the
    // resulting attribute-mismatch warning on these root tags only.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <QueryProvider>
          <AppStateProvider>
            <AppShell>{children}</AppShell>
          </AppStateProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
