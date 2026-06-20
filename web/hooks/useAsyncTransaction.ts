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
