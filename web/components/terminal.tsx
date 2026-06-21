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
        <h2 className="mt-3 font-serif text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl lg:text-6xl">
          Machines that trade, insure, and answer for their record.
        </h2>
        <p className="drop-cap mt-6 max-w-[60ch] text-justify font-body text-[17px] leading-relaxed text-neutral-700">
          Sanctum is a self-contained market where sovereign agents acquire tokenized real-world assets through a sealed-bid
          dark pool, then underwrite parametric cover on those positions, autonomously, with no human at the desk. Every fill,
          premium, and claim is bound to an agent's on-chain reputation. The result is a venue engineered for participants who
          never sleep and never forget.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Btn tone="primary" onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })}>Enter the Market</Btn>
          <Btn tone="outline" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>How It Works</Btn>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:col-span-4 lg:grid-cols-1">
        {[
          { l: "Pool Capital", v: `${Number(formatEther(poolBalance)).toFixed(3)} R` },
          { l: "Drawdown / Trigger", v: `${(Number(drawdownBps) / 100).toFixed(1)}% / ${(triggerBps / 100).toFixed(0)}%`, red: triggered },
          { l: "Registered Agents", v: agentCount },
          { l: "Status", v: settled ? "SETTLED" : triggered ? "TRIGGERED" : "MONITORING", red: triggered, pos: settled || !triggered },
        ].map((s: any, i) => (
          <div key={s.l} className={`flex flex-col justify-center gap-1 p-5 ${i < 3 ? "border-b border-ink" : ""} ${i % 2 === 0 ? "border-r border-ink lg:border-r-0" : ""}`}>
            <Label className="text-neutral-500">{s.l}</Label>
            <span className={`font-mono text-2xl font-medium tabular-nums ${s.red ? "text-editorial" : s.pos ? "text-positive" : "text-ink"}`}>{s.v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------- Section header --------------------------- */
function SectionHead({ kicker, title, sub }: { kicker: string; title: string; sub: string }) {
  return (
    <div className="px-4 pt-12 lg:px-8">
      <div className="border-b border-ink pb-2">
        <Label className="text-neutral-500">{kicker}</Label>
        <h3 className="mt-1 font-serif text-3xl font-black leading-none lg:text-4xl">{title}</h3>
        <p className="mt-2 max-w-[70ch] font-body text-[16px] text-neutral-700">{sub}</p>
      </div>
    </div>
  );
}

/* OVERDRIVE: live Canvas price tape — data drawn left→right as samples arrive */
function PriceTape({ lastPrice, triggered }: { lastPrice: bigint; triggered: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const series = useRef<number[]>([]);

  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 300;
    const h = cv.clientHeight || 64;
    cv.width = Math.floor(w * dpr);
    cv.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(17,17,17,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h - 1);
    ctx.stroke();
    const s = series.current;
    if (s.length < 2) {
      ctx.fillStyle = "rgba(17,17,17,0.4)";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillText("awaiting price samples…", 6, h / 2);
      return;
    }
    const min = Math.min(...s);
    const max = Math.max(...s);
    const range = max - min || 1;
    const stepX = w / (s.length - 1);
    const yOf = (v: number) => h - ((v - min) / range) * (h - 10) - 5;
    ctx.beginPath();
    ctx.moveTo(0, h);
    s.forEach((v, i) => ctx.lineTo(i * stepX, yOf(v)));
    ctx.lineTo((s.length - 1) * stepX, h);
    ctx.closePath();
    ctx.fillStyle = triggered ? "rgba(204,0,0,0.08)" : "rgba(17,17,17,0.06)";
    ctx.fill();
    ctx.beginPath();
    s.forEach((v, i) => (i ? ctx.lineTo(i * stepX, yOf(v)) : ctx.moveTo(i * stepX, yOf(v))));
    ctx.strokeStyle = triggered ? "#CC0000" : "#111111";
    ctx.lineWidth = 2;
    ctx.stroke();
    const lx = (s.length - 1) * stepX;
    const ly = yOf(s[s.length - 1]);
    ctx.fillStyle = triggered ? "#CC0000" : "#15663F";
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  useEffect(() => {
    const v = Number(lastPrice);
    if (v > 0) {
      const s = series.current;
      if (s.length === 0 || s[s.length - 1] !== v) {
        s.push(v);
        if (s.length > 80) s.shift();
      }
    }
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPrice, triggered]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="h-16 w-full" role="img" aria-label="Live price tape" />;
}

/* -------------------------- Underwriter desk -------------------------- */
function UnderwriterDesk(p: any) {
  const tx = useAsyncTransaction();
  const [premium, setPremium] = useState("0.01");
  const ddPct = Number(p.drawdownBps) / 100;
  const trigPct = p.triggerBps / 100;
  const gauge = Math.min(100, (ddPct / Math.max(1, trigPct)) * 100);

  const premiumNum = Number(premium);
  const premiumValid = premium.trim() !== "" && Number.isFinite(premiumNum) && premiumNum > 0;

  async function buy() {
    if (!premiumValid) return;
    const r = await tx.send({ address: CONTRACTS.sentinel, abi: sentinelAbi as any, functionName: "buyPolicy", value: parseEther(premium || "0") });
    if (r.ok) p.onFeed({ kind: "POLICY", text: `You bought cover · premium ${premium} R` });
  }
  async function settle() {
    const r = await tx.send({ address: CONTRACTS.sentinel, abi: sentinelAbi as any, functionName: "settle" });
    if (r.ok) p.onFeed({ kind: "SETTLED", text: "Settlement executed" });
  }

  return (
    <div className={`${p.className ?? ""}`}>
      <Card title="Sentinel Underwriter" kicker="Autonomous Desk" right={<Badge tone="ink">Agent ◇</Badge>} className="border-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Stat label="Pool" value={`${Number(formatEther(p.poolBalance)).toFixed(3)} R`} />
          <Stat label="Liability" value={`${Number(formatEther(p.totalCoverage)).toFixed(3)} R`} />
          <Stat label="Policies" value={p.policyCount} />
          <Stat label="Last Price" value={p.lastPrice.toString()} />
          <Stat label="Window High" value={p.windowHigh.toString()} />
          <Stat label="Payout" value={`${(p.multBps / 10000).toFixed(1)}×`} />
        </div>

        <div className="mt-6">
          <div className="mb-1 flex items-center justify-between">
            <Label className="text-neutral-500">Price tape · drawdown {ddPct.toFixed(2)}% / trigger {trigPct.toFixed(0)}%</Label>
            <Label className={p.triggered ? "text-editorial" : "text-positive"}>{p.triggered ? "Triggered" : "Armed"}</Label>
          </div>
          <div className="border border-ink bg-paper px-1">
            <PriceTape lastPrice={p.lastPrice} triggered={p.triggered} />
          </div>
          <div className="mt-1.5 h-2 w-full border border-ink bg-paper" role="progressbar" aria-valuenow={Math.round(gauge)} aria-valuemax={100} aria-label="Drawdown toward trigger">
            <div className={`h-full ${p.triggered ? "bg-editorial" : "bg-ink"}`} style={{ width: `${gauge}%` }} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-dashed border-ink pt-5">
          <label className="flex flex-col gap-1">
            <Label className="text-neutral-500">Premium (R)</Label>
            <Input value={premium} onChange={(e) => setPremium(e.target.value)} className="w-28" inputMode="decimal" aria-invalid={!premiumValid} aria-describedby="premium-hint" />
          </label>
          <Btn tone="primary" disabled={!p.isConnected || !premiumValid} onClick={buy}>Buy Cover</Btn>
          <Btn tone="positive" disabled={!p.isConnected || !p.triggered || p.settled} onClick={settle}>Settle Claims</Btn>
          <StatusPill state={tx.state} />
        </div>
        {!premiumValid && premium.trim() !== "" && (
          <p id="premium-hint" className="mt-2 font-mono text-[11px] text-editorial">Enter a premium greater than 0.</p>
        )}
        {tx.error && <p className="mt-2 font-mono text-[11px] text-editorial">✗ {tx.error}</p>}
      </Card>
    </div>
  );
}

/* ------------------------------ Dark pool ------------------------------ */
function DarkPool(p: any) {
  const tx = useAsyncTransaction();
  const [maxPrice, setMaxPrice] = useState("3500");
  const [qty, setQty] = useState("10");

  const priceValid = /^\d+$/.test(maxPrice) && BigInt(maxPrice || "0") > 0n;
  const qtyValid = /^\d+$/.test(qty) && BigInt(qty || "0") > 0n;
  const sealValid = priceValid && qtyValid;

  async function submit() {
    if (!p.assetId || !p.block || !sealValid) return;
    const salt = randomSalt();
    const c = commit(BigInt(maxPrice || "0"), salt);
    const r = await tx.send({ address: CONTRACTS.pool, abi: poolAbi as any, functionName: "submitBid", args: [p.assetId, c, "0x", BigInt(qty || "0"), p.block + 5000n] });
    if (r.ok) {
      const key = `sanctum:bids:${p.address}`;
      const prev = JSON.parse(localStorage.getItem(key) || "[]");
      prev.push({ maxPrice, salt });
      localStorage.setItem(key, JSON.stringify(prev));
      p.onFeed({ kind: "SEALED BID", text: `You sealed a bid · qty ${qty} (price hidden)` });
    }
  }
  async function cancel(id: number) {
    const r = await tx.send({ address: CONTRACTS.pool, abi: poolAbi as any, functionName: "cancelBid", args: [BigInt(id)] });
    if (r.ok) p.onFeed({ kind: "CANCEL", text: `You pulled bid #${id}` });
  }
  async function reveal(id: number, idx: number) {
    const key = `sanctum:bids:${p.address}`;
    const rec = JSON.parse(localStorage.getItem(key) || "[]")[idx];
    if (!rec) return p.onFeed({ kind: "ERROR", text: `No local salt for bid #${id}`, red: true });
    await tx.send({ address: CONTRACTS.pool, abi: poolAbi as any, functionName: "revealAndFill", args: [BigInt(id), BigInt(rec.maxPrice), rec.salt] });
  }

  return (
    <div className={`${p.className ?? ""}`}>
      <Card title="SilentBid Dark Pool" kicker="Sealed Execution" right={<Badge tone="ink">Cancel-Priority</Badge>} className="border-0">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <Label className="text-neutral-500">Max Price (sealed)</Label>
            <Input value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-28" inputMode="numeric" />
          </label>
          <label className="flex flex-col gap-1">
            <Label className="text-neutral-500">Qty</Label>
            <Input value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" inputMode="numeric" />
          </label>
          <Btn tone="primary" disabled={!p.isConnected || !sealValid} onClick={submit}>Seal Bid</Btn>
          <StatusPill state={tx.state} />
        </div>
        {!sealValid && (maxPrice.trim() !== "" || qty.trim() !== "") && (
          <p className="mt-2 font-mono text-[11px] text-editorial">Price and quantity must be whole numbers greater than 0.</p>
        )}
        <p className="mt-2 font-mono text-[10px] text-neutral-500">Committed as keccak256(price, salt) and never broadcast. Salt stored locally for reveal.</p>

        <table className="mt-5 w-full border-collapse font-mono text-[12px]">
          <thead>
            <tr className="border-y border-ink text-left">
              {["#", "Bidder", "Qty", "Status", "Action"].map((h) => (
                <th key={h} className="px-2 py-2"><Label className="text-neutral-500">{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {p.bidIds.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-neutral-400">No bids on the tape yet.</td></tr>}
            {p.bidIds.map((id: number, i: number) => {
              const b: any = p.bids?.[i]?.result;
              if (!b) return null;
              const status = BID_STATUS[Number(b.status)];
              const mine = p.address && b.bidder.toLowerCase() === p.address.toLowerCase();
              return (
                <tr key={id} className="border-b border-divider hover:bg-neutral-100">
                  <td className="px-2 py-2 font-bold">{id}</td>
                  <td className="px-2 py-2 text-neutral-600">{shortAddr(b.bidder)}{mine && <span className="ml-1 text-positive">·you</span>}</td>
                  <td className="px-2 py-2">{b.quantity.toString()}</td>
                  <td className="px-2 py-2"><Badge tone={status === "Filled" ? "positive" : status === "Open" ? "outline" : "muted"}>{status}</Badge></td>
                  <td className="px-2 py-2">
                    {mine && status === "Open" ? (
                      <span className="flex gap-3">
                        <button onClick={() => cancel(id)} aria-label={`Cancel bid ${id}`} className="uppercase tracking-wider text-ink underline decoration-editorial decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper">cancel</button>
                        <button onClick={() => reveal(id, i)} aria-label={`Reveal and fill bid ${id}`} className="uppercase tracking-wider text-ink underline decoration-ink decoration-2 underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper">reveal</button>
                      </span>
                    ) : <span className="text-neutral-400">·</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tx.error && <p className="mt-2 font-mono text-[11px] text-editorial">✗ {tx.error}</p>}
      </Card>
    </div>
  );
}

/* ----------------------------- Reputation ----------------------------- */
function Reputation({ agents, rep, className }: { agents: Address[]; rep: any; className?: string }) {
  return (
    <div id="reputation" className={className}>
      <Card title="Aegis Reputation" kicker="Ledger of Record" right={<Badge tone="outline">{agents.length} agents</Badge>} className="border-0">
        {agents.length === 0 ? (
          <p className="font-body text-[15px] text-neutral-600">No agents on the register yet. The first bid or policy onboards one.</p>
        ) : (
          <table className="w-full border-collapse font-mono text-[12px]">
            <thead>
              <tr className="border-y border-ink text-left">
                {["Agent", "Role", "Fills", "Settlements", "Score"].map((h) => (
                  <th key={h} className="px-2 py-2"><Label className="text-neutral-500">{h}</Label></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map((a, i) => {
                const r: any = rep?.[i * 2]?.result;
                const score = (rep?.[i * 2 + 1]?.result as bigint) ?? 0n;
                return (
                  <tr key={a} className="border-b border-divider hover:bg-neutral-100">
                    <td className="px-2 py-2 text-neutral-600">{shortAddr(a)}</td>
                    <td className="px-2 py-2">{r ? ROLE_LABEL[Number(r.role)] : "·"}</td>
                    <td className="px-2 py-2">{r ? r.fills.toString() : "·"}</td>
                    <td className="px-2 py-2">{r ? r.settlements.toString() : "·"}</td>
                    <td className="px-2 py-2 font-bold text-positive">{score.toString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------- Settlement report ------------------------- */
function SettlementReport({ report, className }: { report: string; className?: string }) {
  return (
    <div className={className}>
      <Card title="Settlement Report" kicker="Filed by the Underwriter" right={<Badge tone="ink">AI ◇ GLM-4.7</Badge>} className="border-0">
        {report ? (
          <p className="drop-cap max-w-[68ch] text-justify font-body text-[16px] italic leading-relaxed text-neutral-700">{report}</p>
        ) : (
          <p className="font-body text-[15px] text-neutral-600">No settlement narrative filed yet. The underwriter writes one via the LLM precompile after a claim settles.</p>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------- How it works ----------------------------- */
function HowItWorks() {
  const steps = [
    { n: "01", t: "Seal a Bid", d: "An agent commits keccak256(price, salt) to the dark pool. The price never touches the mempool, so it cannot be front-run." },
    { n: "02", t: "Cancel Beats Take", d: "Enshrined single-contract sequencing orders cancels before fills in the same block, so a trader can always pull a bid before being picked off." },
    { n: "03", t: "Underwrite Autonomously", d: "The Sentinel agent wakes itself via the Scheduler, fetches the price on-chain over HTTP, and arms parametric cover on open positions." },
    { n: "04", t: "Settle & Remember", d: "On a drawdown trigger the agent pays claims from its pool, writes a narrative via the LLM, and records the outcome to its Aegis reputation." },
  ];
  return (
    <section id="how" className="border-t-4 border-ink bg-ink text-paper">
      <div className="px-4 pt-12 lg:px-8">
        <div className="border-b border-paper/40 pb-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-neutral-400">The Mechanism</span>
          <h3 className="mt-1 font-serif text-3xl font-black leading-none lg:text-4xl">How It Works</h3>
        </div>
      </div>
      <div className="mt-8 grid grid-cols-1 border-t border-paper/30 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.n} className={`p-6 lg:p-8 ${i < 3 ? "border-b border-paper/30 lg:border-b-0 lg:border-r" : ""} ${i === 0 ? "md:border-r" : ""} ${i === 2 ? "md:border-r-0 lg:border-r" : ""} ${i < 2 ? "md:border-b" : ""} lg:border-paper/30`}>
            <span className="font-serif text-4xl font-black text-editorial">{s.n}</span>
            <h4 className="mt-3 font-serif text-xl font-bold">{s.t}</h4>
            <p className="mt-2 font-body text-[15px] leading-7 tracking-[0.01em] text-neutral-300">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------- FAQ -------------------------------- */
function Faq() {
  const items: [string, string][] = [
    ["What makes Sanctum a dark pool?", "Bids are sealed as a hash commitment of (price, salt). The price you are willing to pay is never written on-chain at submission, so no observer (human or bot) can read it from the mempool and front-run you. You reveal only at fill time."],
    ["How does cancel-priority protect me?", "Sanctum declares its function ordering to the block builder via Ritual's single-contract sequencing rights. Cancels are a higher priority level than reveals, so a cancel landing in the same block as an adverse fill executes first. You can always pull a bid before it is taken."],
    ["Who runs the underwriter?", "Nobody. The Sentinel underwriter is an autonomous agent: it schedules its own wake-ups, fetches prices on-chain through Ritual's HTTP precompile, evaluates a pure-arithmetic drawdown trigger, and settles claims from its own capital pool. There is no human operator and no off-chain keeper."],
    ["Why is the settlement report in italics?", "Any text produced by an AI precompile is marked as machine-authored. The narrative is written on-chain by the LLM precompile (GLM-4.7) after a claim settles. It explains the payout in plain language but never decides it. The payout itself is deterministic arithmetic."],
    ["What is Aegis reputation?", "Every agent is keyed by its on-chain identity and accrues a verifiable track record: fills, premiums earned, claims honored, defaults. The score rises with honored settlements and falls hard with defaults. Over time this becomes the dataset counterparties price trust from."],
    ["Is this real money?", "No. Sanctum runs on the Ritual testnet (chain 1979). All RITUAL is free testnet currency with no real-world value. Connect a wallet, request testnet tokens from the faucet, and participate without risk."],
  ];
  return (
    <section id="faq" className="border-t-4 border-ink">
      <div className="px-4 pt-12 lg:px-8">
        <div className="border-b border-ink pb-2">
          <Label className="text-neutral-500">Questions of Record</Label>
          <h3 className="mt-1 font-serif text-3xl font-black leading-none lg:text-4xl">Frequently Asked</h3>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-x-12 px-4 pb-12 lg:grid-cols-2 lg:px-8">
        {items.map(([q, a]) => (
          <Accordion key={q} q={q}>{a}</Accordion>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- Footer ------------------------------- */
function Footer() {
  return (
    <footer className="border-t-4 border-ink bg-paper">
      <div className="grid grid-cols-1 md:grid-cols-12">
        <div className="border-ink p-6 md:col-span-5 md:border-r lg:p-8">
          <h4 className="font-serif text-3xl font-black leading-none">SANCTUM</h4>
          <p className="mt-3 max-w-[42ch] font-body text-[15px] text-neutral-700">An agent-native market for real-world assets on Ritual Chain. Sealed-bid execution, autonomous underwriting, and a reputation ledger for machines.</p>
          <p className="mt-4"><Label className="text-neutral-500">Edition: Vol 1.0 · Printed on Ritual · Chain 1979</Label></p>
          <div className="mt-4 flex items-center gap-3">
            <GitHubLink href={GITHUB_URL} />
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-ink underline decoration-2 underline-offset-4 hover:text-editorial">Source on GitHub</a>
          </div>
        </div>
        <div className="grid grid-cols-2 md:col-span-7 lg:grid-cols-3">
          {[
            { h: "Contracts", rows: [["Aegis", CONTRACTS.aegis], ["Pool", CONTRACTS.pool], ["Sentinel", CONTRACTS.sentinel]] },
            { h: "Network", rows: [["Chain", "1979" as any], ["RPC", "rpc.ritualfoundation.org" as any], ["Faucet", "faucet.ritualfoundation.org" as any]] },
            { h: "Sections", rows: [["Market", "#market" as any], ["How It Works", "#how" as any], ["FAQ", "#faq" as any]] },
          ].map((col, i) => (
            <div key={col.h} className={`p-6 ${i < 2 ? "border-r border-ink" : ""} border-t border-ink md:border-t-0 lg:p-8`}>
              <Label className="text-neutral-500">{col.h}</Label>
              <ul className="mt-3 space-y-2">
                {col.rows.map(([k, v]) => (
                  <li key={k} className="font-mono text-[11px] text-neutral-600">
                    <span className="text-neutral-400">{k} </span>
                    {typeof v === "string" && v.startsWith("0x") ? (
                      <a href={`${EXPLORER_URL}/address/${v}`} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 hover:text-editorial">{shortAddr(v)}</a>
                    ) : (
                      v
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-ink px-4 py-3 text-center">
        <Label className="text-neutral-400">All the trades that are fit to settle. © Vol. 1</Label>
      </div>
    </footer>
  );
}
