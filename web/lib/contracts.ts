import type { Address } from "viem";

export const GITHUB_URL = "https://github.com/0x03sol/SANCTUM";
export const EXPLORER_URL = "https://explorer.ritualfoundation.org";

export const CONTRACTS = {
  aegis: (process.env.NEXT_PUBLIC_AEGIS_REGISTRY ?? "0x0000000000000000000000000000000000000000") as Address,
  pool: (process.env.NEXT_PUBLIC_SILENTBID_POOL ?? "0x0000000000000000000000000000000000000000") as Address,
  sentinel: (process.env.NEXT_PUBLIC_SENTINEL_UNDERWRITER ?? "0x0000000000000000000000000000000000000000") as Address,
};

export const ROLE_LABEL = ["—", "Trader", "Underwriter", "Reinsurer"] as const;

export const BID_STATUS = ["None", "Open", "Cancelled", "Filled", "Expired"] as const;

export function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function bps(n?: bigint | number) {
  if (n === undefined) return "—";
  return `${(Number(n) / 100).toFixed(2)}%`;
}
