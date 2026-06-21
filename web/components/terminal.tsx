"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useBlockNumber,
  useConnect,
  useDisconnect,
  useReadContracts,
  useWatchContractEvent,
} from "wagmi";
import { encodeAbiParameters, formatEther, keccak256, parseEther, type Address } from "viem";
import { aegisAbi, poolAbi, sentinelAbi } from "@/lib/abis";
import { BID_STATUS, CONTRACTS, EXPLORER_URL, GITHUB_URL, ROLE_LABEL, bps, shortAddr } from "@/lib/contracts";
import { useAsyncTransaction } from "@/hooks/useAsyncTransaction";
import { Accordion, Badge, Btn, Card, GitHubLink, Input, Label, Marquee, Ornament, Stat, StatusPill } from "./ui";

type FeedItem = { id: string; kind: string; text: string; t: number; red?: boolean };

function randomSalt(): `0x${string}` {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return ("0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}
function commit(maxPrice: bigint, salt: `0x${string}`) {
  return keccak256(encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [maxPrice, salt]));
}

export function Terminal() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: block } = useBlockNumber({ watch: true });
  const { data: bal } = useBalance({ address });

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const pushFeed = (f: Omit<FeedItem, "id" | "t">) => setFeed((p) => [{ ...f, id: crypto.randomUUID(), t: Date.now() }, ...p].slice(0, 60));

  // ---- reads (unchanged logic) ----
  const sentinel = { address: CONTRACTS.sentinel, abi: sentinelAbi } as const;
  const { data: sd } = useReadContracts({
    contracts: [
      { ...sentinel, functionName: "assetId" },
      { ...sentinel, functionName: "poolBalance" },
      { ...sentinel, functionName: "totalCoverage" },
      { ...sentinel, functionName: "currentDrawdownBps" },
      { ...sentinel, functionName: "triggerBps" },
      { ...sentinel, functionName: "payoutMultiplierBps" },
      { ...sentinel, functionName: "triggered" },
      { ...sentinel, functionName: "settled" },
      { ...sentinel, functionName: "policyCount" },
      { ...sentinel, functionName: "lastPrice" },
      { ...sentinel, functionName: "windowHigh" },
      { ...sentinel, functionName: "lastReport" },
    ],
    query: { refetchInterval: 5000 },
  });
  const R = (i: number) => sd?.[i]?.result as any;
  const assetId = R(0) as `0x${string}` | undefined;
  const poolBalance = (R(1) as bigint) ?? 0n;
  const totalCoverage = (R(2) as bigint) ?? 0n;
  const drawdownBps = (R(3) as bigint) ?? 0n;
  const triggerBps = (R(4) as number) ?? 0;
  const multBps = (R(5) as number) ?? 0;
  const triggered = (R(6) as boolean) ?? false;
  const settled = (R(7) as boolean) ?? false;
  const policyCount = Number((R(8) as bigint) ?? 0n);
  const lastPrice = (R(9) as bigint) ?? 0n;
  const windowHigh = (R(10) as bigint) ?? 0n;
  const lastReport = (R(11) as string) ?? "";

  const { data: agentCountData } = useReadContracts({
    contracts: [{ address: CONTRACTS.aegis, abi: aegisAbi, functionName: "agentCount" }],
    query: { refetchInterval: 8000 },
  });
  const agentCount = Number((agentCountData?.[0]?.result as bigint) ?? 0n);
  const { data: agentAddrs } = useReadContracts({
    contracts: Array.from({ length: agentCount }, (_, i) => ({ address: CONTRACTS.aegis, abi: aegisAbi, functionName: "agentAt", args: [BigInt(i)] })),
  });
  const agentList = (agentAddrs?.map((a) => a.result as unknown as Address).filter(Boolean) ?? []) as Address[];
  const { data: agentRep } = useReadContracts({
    contracts: agentList.flatMap((a) => [
      { address: CONTRACTS.aegis, abi: aegisAbi, functionName: "reputationOf", args: [a] },
      { address: CONTRACTS.aegis, abi: aegisAbi, functionName: "score", args: [a] },
    ]),
    query: { refetchInterval: 8000 },
  });

  const { data: bidCountData } = useReadContracts({
    contracts: [{ address: CONTRACTS.pool, abi: poolAbi, functionName: "nextBidId" }],
    query: { refetchInterval: 5000 },
  });
  const nextBidId = Number((bidCountData?.[0]?.result as bigint) ?? 1n);
  const bidIds = Array.from({ length: Math.max(0, nextBidId - 1) }, (_, i) => i + 1);
  const { data: bidData } = useReadContracts({
    contracts: bidIds.map((id) => ({ address: CONTRACTS.pool, abi: poolAbi, functionName: "getBid", args: [BigInt(id)] })),
    query: { refetchInterval: 5000 },
  });

  // ---- live events ----
  useWatchContractEvent({ address: CONTRACTS.pool, abi: poolAbi, eventName: "BidSubmitted", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "SEALED BID", text: `#${e.args.bidId} · ${shortAddr(e.args.bidder)} · qty ${e.args.quantity}` })) });
  useWatchContractEvent({ address: CONTRACTS.pool, abi: poolAbi, eventName: "BidCancelled", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "CANCEL", text: `Bid #${e.args.bidId} pulled (cancel-priority)` })) });
  useWatchContractEvent({ address: CONTRACTS.pool, abi: poolAbi, eventName: "BidFilled", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "FILL", text: `Bid #${e.args.bidId} filled @ ${e.args.clearingPrice}` })) });
  useWatchContractEvent({ address: CONTRACTS.sentinel, abi: sentinelAbi, eventName: "PolicyBought", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "POLICY", text: `#${e.args.policyId} · payout ${formatEther(e.args.payout)} R` })) });
  useWatchContractEvent({ address: CONTRACTS.sentinel, abi: sentinelAbi, eventName: "PriceRecorded", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "PRICE", text: `${e.args.price} · high ${e.args.windowHigh} · dd ${bps(e.args.drawdownBps)}` })) });
  useWatchContractEvent({ address: CONTRACTS.sentinel, abi: sentinelAbi, eventName: "Triggered", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "BREAKING", text: `DRAWDOWN TRIGGER · ${bps(e.args.drawdownBps)} from high`, red: true })) });
  useWatchContractEvent({ address: CONTRACTS.sentinel, abi: sentinelAbi, eventName: "PolicySettled", onLogs: (l: any) => l.forEach((e: any) => pushFeed({ kind: "SETTLED", text: `Policy #${e.args.policyId} paid ${formatEther(e.args.payout)} R` })) });

  const tickerItems = feed.slice(0, 14).map((f) => `${f.kind}: ${f.text}`);

  // OVERDRIVE: fire a one-shot ink-flash when the drawdown trigger first fires this session
  const [flash, setFlash] = useState(false);
  const prevTrig = useRef(false);
  useEffect(() => {
    if (triggered && !prevTrig.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      prevTrig.current = triggered;
      return () => clearTimeout(t);
    }
    prevTrig.current = triggered;
  }, [triggered]);

  return (
    <div id="top" className="min-h-screen w-full bg-paper px-0 sm:px-[2vw] lg:px-[4vw] xl:px-[5vw]">
      <Masthead flash={flash} block={block} isConnected={isConnected} address={address} balance={bal?.value} onConnect={() => connect({ connector: connectors[0] })} onDisconnect={() => disconnect()} />
      {/* full-bleed ticker: cancel the root's side padding so it spans edge-to-edge */}
      <div className="mx-0 sm:-mx-[2vw] lg:-mx-[4vw] xl:-mx-[5vw]">
        <Marquee items={tickerItems} />
      </div>
      {/* accessible mirror of the decorative ticker for screen readers */}
      <div role="log" aria-live="polite" aria-label="Market activity" className="sr-only">
        {feed[0] ? `${feed[0].kind}: ${feed[0].text}` : "Awaiting market activity."}
      </div>

      {/* OVERDRIVE: breaking-news stamp — only on a real on-chain trigger, full-bleed */}
      {triggered && !settled && (
        <div className="mx-0 sm:-mx-[2vw] lg:-mx-[4vw] xl:-mx-[5vw]">
          <div className="animate-stamp origin-left border-y-2 border-editorial bg-editorial px-4 py-2.5 text-paper lg:px-8">
            <p className="font-serif text-lg font-black uppercase leading-none tracking-tight lg:text-2xl">
              ⚠ Breaking: drawdown trigger active. Claims are now settleable.
            </p>
          </div>
        </div>
      )}

      <Hero poolBalance={poolBalance} drawdownBps={drawdownBps} triggerBps={triggerBps} agentCount={agentCount} policyCount={policyCount} triggered={triggered} settled={settled} />

      <Ornament />

      <SectionHead kicker="The Trading Floor" title="Live Market" sub="Sealed-bid execution and autonomous underwriting, settling on-chain in real time." />
      <div id="market" className="grid grid-cols-1 border-t border-ink lg:grid-cols-2">
        <UnderwriterDesk className="border-b border-ink lg:border-r" poolBalance={poolBalance} totalCoverage={totalCoverage} drawdownBps={drawdownBps} triggerBps={triggerBps} multBps={multBps} triggered={triggered} settled={settled} policyCount={policyCount} lastPrice={lastPrice} windowHigh={windowHigh} isConnected={isConnected} onFeed={pushFeed} />
        <DarkPool className="border-b border-ink" assetId={assetId} bids={bidData} bidIds={bidIds} address={address} isConnected={isConnected} block={block} onFeed={pushFeed} />
        <Reputation className="border-b border-ink lg:border-r" agents={agentList} rep={agentRep} />
        <SettlementReport className="border-b border-ink" report={lastReport} />
      </div>

      <HowItWorks />
      <Faq />
      <Footer />
    </div>
  );
}

/* ----------------------------- Masthead ----------------------------- */
function Masthead({ flash, block, isConnected, address, balance, onConnect, onDisconnect }: any) {
  const nav: [string, string][] = [
    ["Market", "#market"],
    ["How It Works", "#how"],
    ["Reputation", "#reputation"],
    ["FAQ", "#faq"],
  ];
  return (
    <header className={`sticky top-0 z-40 border-b-4 bg-paper ${flash ? "border-editorial" : "border-ink"}`}>
      {/* main bar: brand (left) · nav · wallet (right) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 lg:px-8">
        <a href="#top" className="flex items-baseline gap-3">
          <span className={`font-serif text-3xl font-black leading-none tracking-tighter ${flash ? "animate-ink-flash" : ""}`}>SANCTUM</span>
          <Label className="hidden text-neutral-500 md:block">Agent-Native RWA Market</Label>
        </a>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t border-ink pt-2 lg:order-2 lg:w-auto lg:flex-1 lg:border-t-0 lg:pl-4 lg:pt-0">
          {nav.map(([l, h]) => (
            <a
              key={l}
              href={h}
              className="whitespace-nowrap px-3 py-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-ink transition-colors duration-200 hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              {l}
            </a>
          ))}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-3 lg:order-3">
          <Label className="hidden text-neutral-500 sm:block">BLK {block ? block.toString() : "·"}</Label>
          <GitHubLink href={GITHUB_URL} />
          {isConnected ? (
            <button onClick={onDisconnect} className="min-h-[44px] border border-ink px-3 font-mono text-[11px] hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
              {shortAddr(address)} · {balance ? Number(formatEther(balance)).toFixed(3) : "0"} R
            </button>
          ) : (
            <Btn onClick={onConnect}>Connect Wallet</Btn>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------- Hero ------------------------------- */
function Hero({ poolBalance, drawdownBps, triggerBps, agentCount, policyCount, triggered, settled }: any) {
  return (
    <section className="newsprint-texture grid grid-cols-1 border-b border-ink lg:grid-cols-12">
      <div className="border-ink p-6 lg:col-span-8 lg:border-r lg:p-10">
        <Label className={triggered ? "text-editorial" : "text-neutral-500"}>{triggered ? "Breaking · Drawdown Trigger Active" : "Market Dispatch"}</Label>
