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
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-[44px] items-center justify-center px-5 py-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${tones[tone]} ${full ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-[44px] w-full border-b-2 border-ink bg-transparent px-2 py-2 font-mono text-sm text-ink placeholder:text-neutral-400 focus-visible:bg-[#F0F0F0] focus-visible:outline-none ${props.className ?? ""}`}
    />
  );
}

type BadgeTone = "ink" | "red" | "outline" | "muted" | "positive";
export function Badge({ children, tone = "outline" }: { children: ReactNode; tone?: BadgeTone }) {
  const t: Record<BadgeTone, string> = {
    ink: "bg-ink text-paper border border-ink",
    red: "bg-editorial text-paper border border-editorial",
    outline: "border border-ink text-ink",
    muted: "border border-neutral-300 text-neutral-500",
    positive: "bg-positive text-paper border border-positive",
  };
  return <span className={`inline-block px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${t[tone]}`}>{children}</span>;
}

export function Stat({ label, value, accentRed = false }: { label: string; value: ReactNode; accentRed?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-neutral-500">{label}</Label>
      <span className={`font-mono text-xl font-medium tabular-nums ${accentRed ? "text-editorial" : "text-ink"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

/* GitHub icon link — newsprint bordered-icon style, inverts on hover */
export function GitHubLink({ href, label = "View source on GitHub" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title="Source on GitHub"
      className="inline-flex h-11 w-11 items-center justify-center border border-ink text-ink transition-colors duration-200 hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden focusable="false">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  );
}
export function Ornament() {
  return (
    <div aria-hidden className="py-8 text-center font-serif text-2xl tracking-[1em] text-neutral-400">
      ✧ ✧ ✧
    </div>
  );
}

/* 9-state async tx status, newsprint-styled */
export function StatusPill({ state }: { state: TxState }) {
  if (state === "IDLE") return null;
  const labels: Record<TxState, string> = {
    IDLE: "Idle",
    CONFIRMING: "Confirm in wallet",
    SUBMITTED: "Submitted",
    COMMITTED: "Committed",
    EXECUTING: "Executing · TEE",
    SETTLING: "Settling",
    SETTLED: "Result ready",
    COMPLETED: "Filed ✓",
    ERROR: "Failed ✗",
  };
  const isErr = state === "ERROR";
  const isDone = state === "COMPLETED";
  return (
    <span
      role="status"
      aria-label={`Status: ${labels[state]}`}
      className={`inline-flex items-center gap-2 border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
        isErr ? "border-editorial text-editorial" : isDone ? "bg-positive text-paper border-positive" : "border-ink text-ink"
      }`}
    >
      <span className={`h-2 w-2 ${isErr ? "bg-editorial" : isDone ? "bg-positive" : "bg-ink"} ${!isErr && !isDone ? "animate-pulse" : ""}`} />
      {labels[state]}
    </span>
  );
}

/* black breaking-news ticker — seamless, gap-free fill */
export function Marquee({ items }: { items: string[] }) {
  const base = items.length
    ? items.join("  ◆  ")
    : "Awaiting market activity. Connect a wallet to participate.";
  const unit = `${base}  ◆  `;
  // repeat enough that one track always exceeds the viewport (no empty gap)
  const track = unit.repeat(items.length > 6 ? 2 : 6);
  return (
    <div aria-hidden className="overflow-hidden border-y border-ink bg-ink py-2 text-paper">
      <div className="flex w-max animate-marquee">
        <span className="shrink-0 font-mono text-xs uppercase tracking-[0.18em]">{track}</span>
        <span aria-hidden className="shrink-0 font-mono text-xs uppercase tracking-[0.18em]">{track}</span>
      </div>
    </div>
  );
}

/* FAQ accordion item — rotating + icon, grid-rows animation */
export function Accordion({ q, children }: { q: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <span className="font-serif text-lg font-bold lg:text-xl">{q}</span>
        <span className={`font-mono text-2xl leading-none transition-transform duration-200 ${open ? "rotate-45 text-editorial" : "text-ink"}`}>+</span>
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="max-w-[68ch] pb-5 font-body text-[16px] leading-relaxed text-neutral-700">{children}</div>
        </div>
      </div>
    </div>
  );
}
