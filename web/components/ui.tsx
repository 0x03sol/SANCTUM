"use client";

import { useState, type ReactNode } from "react";
import type { TxState } from "@/hooks/useAsyncTransaction";

/* Uppercase mono section label / metadata */
export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] uppercase tracking-[0.2em] ${className}`}>{children}</span>;
}

/* Newspaper section card — sharp black border, heavy header rule */
export function Card({
  title,
  kicker,
  right,
  children,
  className = "",
  inverted = false,
}: {
  title?: string;
  kicker?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <section className={`border border-ink ${inverted ? "bg-ink text-paper" : "bg-paper text-ink"} ${className}`}>
      {(title || right) && (
        <header className={`flex items-end justify-between gap-3 border-b-4 ${inverted ? "border-paper" : "border-ink"} px-4 py-3`}>
          <div className="flex flex-col gap-0.5">
            {kicker && <Label className={inverted ? "text-neutral-300" : "text-neutral-500"}>{kicker}</Label>}
            {title && <h2 className="font-serif text-2xl font-bold leading-none lg:text-3xl">{title}</h2>}
          </div>
          {right}
        </header>
      )}
      <div className="p-4 lg:p-6">{children}</div>
    </section>
  );
}

type BtnTone = "primary" | "outline" | "ghost" | "link" | "danger" | "positive";
export function Btn({
  children,
  onClick,
  tone = "primary",
  disabled,
  type = "button",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: BtnTone;
  disabled?: boolean;
  type?: "button" | "submit";
  full?: boolean;
}) {
  const tones: Record<BtnTone, string> = {
    primary: "bg-ink text-paper border border-ink hover:bg-paper hover:text-ink",
    outline: "border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper",
    ghost: "border border-transparent text-ink hover:bg-divider",
    link: "text-ink underline-offset-4 decoration-2 decoration-editorial hover:underline border-none px-0",
    danger: "border border-editorial text-editorial bg-transparent hover:bg-editorial hover:text-paper",
    positive: "border border-positive text-positive bg-transparent hover:bg-positive hover:text-paper",
  };
  return (
    <button
