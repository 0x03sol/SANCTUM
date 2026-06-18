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
