"use client";

import { useCallback, useState } from "react";
import { usePublicClient, useWriteContract } from "wagmi";
import type { Abi, Address } from "viem";

/**
 * Ritual async lifecycle (9 states). Plain EVM writes traverse a subset
 * (IDLE → CONFIRMING → SUBMITTED → COMPLETED | ERROR); async-precompile flows
 * additionally surface COMMITTED/EXECUTING/SETTLING/SETTLED. We expose the full
 * machine so the UI's status component is reusable across both.
 */
export type TxState =
  | "IDLE"
  | "CONFIRMING" // awaiting wallet signature
  | "SUBMITTED" // broadcast, tx hash known
  | "COMMITTED" // executor accepted (async precompile)
  | "EXECUTING" // running in TEE (async precompile)
  | "SETTLING" // result settling
  | "SETTLED" // result available
  | "COMPLETED" // receipt mined OK
  | "ERROR";

export const STATE_META: Record<
  TxState,
  { label: string; dot: string; text: string; icon: string; pulse?: boolean }
> = {
  IDLE: { label: "Idle", dot: "bg-gray-600", text: "text-gray-500", icon: "·" },
  CONFIRMING: { label: "Confirm in wallet", dot: "bg-ritual-gold", text: "text-ritual-gold", icon: "◌", pulse: true },
  SUBMITTED: { label: "Submitted", dot: "bg-ritual-gold", text: "text-ritual-gold", icon: "◉", pulse: true },
  COMMITTED: { label: "Committed", dot: "bg-ritual-gold", text: "text-ritual-gold", icon: "◉" },
  EXECUTING: { label: "Executing in TEE", dot: "bg-ritual-green", text: "text-ritual-green", icon: "⟳", pulse: true },
  SETTLING: { label: "Settling", dot: "bg-ritual-gold", text: "text-ritual-gold", icon: "◎" },
  SETTLED: { label: "Result ready", dot: "bg-ritual-green", text: "text-ritual-green", icon: "◈" },
  COMPLETED: { label: "Completed", dot: "bg-ritual-green", text: "text-ritual-green", icon: "✓" },
  ERROR: { label: "Failed", dot: "bg-ritual-red", text: "text-ritual-red", icon: "✗" },
};

/** Map raw viem/contract errors to plain-language sentences for end users. */
const ERROR_MESSAGES: Record<string, string> = {
  NoPremium: "Enter a premium greater than 0 RITUAL.",
  PoolCannotCover: "The underwriter's pool can't back this coverage right now.",
  PriceNotMet: "Your sealed max price is below the current clearing price, so it can't fill.",
  NoClearingPrice: "No clearing price has been posted for this asset yet.",
  BadReveal: "The reveal doesn't match your sealed bid (wrong price or salt).",
  BidNotOpen: "This bid is no longer open.",
  BidIsExpired: "This bid has expired.",
  NotTriggered: "The drawdown trigger hasn't fired yet — nothing to settle.",
  AlreadySettled: "This underwriter has already settled its claims.",
  NotBidder: "Only the original bidder can do that.",
  BadExpiry: "The expiry block must be in the future.",
  BlobTooLarge: "The sealed payload is too large (max 10 KB).",
};

export function prettyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? "Unknown error");
  // wallet rejection
  if (/user rejected|user denied|rejected the request|4001/i.test(raw)) {
    return "You rejected the transaction in your wallet.";
  }
  if (/insufficient funds/i.test(raw)) {
    return "Not enough RITUAL to cover gas. Top up from the faucet.";
  }
  // known custom errors (viem includes the error name in the message)
  for (const [name, friendly] of Object.entries(ERROR_MESSAGES)) {
    if (raw.includes(name)) return friendly;
  }
  // viem often exposes a concise shortMessage
  const anyE = e as { shortMessage?: string };
  if (anyE?.shortMessage) return anyE.shortMessage.slice(0, 160);
  return raw.split("\n")[0].slice(0, 160);
}

export function useAsyncTransaction() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<TxState>("IDLE");
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string>();

  const reset = useCallback(() => {
    setState("IDLE");
    setHash(undefined);
    setError(undefined);
  }, []);

  const send = useCallback(
    async (params: {
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
      value?: bigint;
    }) => {
      try {
        setError(undefined);
        setState("CONFIRMING");
        const txHash = await writeContractAsync({
          address: params.address,
          abi: params.abi,
          functionName: params.functionName,
          args: params.args as never,
          value: params.value,
        });
        setHash(txHash);
        setState("SUBMITTED");
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status === "reverted") {
          setState("ERROR");
          setError("The transaction was mined but reverted on-chain.");
          return { ok: false as const, hash: txHash };
        }
        setState("COMPLETED");
        return { ok: true as const, hash: txHash };
      } catch (e: unknown) {
        setError(prettyError(e));
        setState("ERROR");
        return { ok: false as const };
      }
    },
    [publicClient, writeContractAsync],
  );

  return { state, hash, error, send, reset };
}
