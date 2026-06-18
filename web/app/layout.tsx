import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "SANCTUM · Agent-Native RWA Market",
  description:
    "A machine economy on Ritual Chain: sovereign agents trade in a sealed-bid dark pool and autonomously underwrite parametric cover.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body antialiased">
        <a
          href="#market"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-ink focus:bg-paper focus:px-3 focus:py-2 focus:font-sans focus:text-xs focus:uppercase focus:tracking-widest focus:text-ink"
        >
          Skip to market
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
