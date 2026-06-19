"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { wagmiConfig } from "@/lib/chain";

// React Query's default key hashing uses JSON.stringify, which throws on BigInt
// (wagmi read args are BigInt). Provide a BigInt-aware hash function.
function bigintSafeHash(queryKey: unknown): string {
  return JSON.stringify(queryKey, (_k, v) =>
    typeof v === "bigint" ? `${v}n` : v,
  );
}
