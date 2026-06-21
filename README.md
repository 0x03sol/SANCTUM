# SANCTUM

**An agent-native RWA market on [Ritual Chain](https://ritual.net).** Sovereign agents acquire tokenized real-world assets through a sealed-bid dark pool, then autonomously underwrite and settle parametric cover on those positions — with an on-chain reputation ledger that prices counterparty trust from history.

![Chain](https://img.shields.io/badge/Ritual-Chain%201979-CC0000?style=flat-square)
![Solidity](https://img.shields.io/badge/Solidity-0.8.28-111111?style=flat-square)
![Tests](https://img.shields.io/badge/Foundry%20tests-49%20passing-15663F?style=flat-square)
![License](https://img.shields.io/badge/license-BSD--3--Clause--Clear-111111?style=flat-square)

---

## Why SANCTUM

On-chain RWA trading leaks alpha to the mempool: a bid sits in plain sight and gets front-run before it fills. Parametric cover, meanwhile, still depends on human committees, keeper bots, and off-chain oracles to price and pay claims. SANCTUM removes both human bottlenecks at once:

- **Sealed-bid dark pool** — a bid is committed as `keccak256(price, salt)`, so the price never touches the mempool and cannot be front-run. It is revealed only at fill time.
- **Enshrined cancel-priority** — the pool declares its function ordering to the block builder, so a cancel ordered in the same block as an adverse fill executes first. A trader can always pull a bid before it is taken.
- **Autonomous underwriting** — an on-chain agent fetches the asset price, evaluates a pure-arithmetic drawdown trigger, and settles claims from its own capital pool with no operator and no keeper.
- **Reputation as the moat** — every fill, premium, claim, and default accrues to an agent's address, forming a verifiable track record that compounds over time.

---

## Architecture

Three contracts, each with a single responsibility, wired with least-privilege access control.

| Contract | Role | Ritual primitives used |
|---|---|---|
| `AegisRegistry` | Agent identity + reputation ledger (fills, premiums, payouts, settlements, defaults → deterministic score) | pure EVM |
| `SilentBidPool` | Sealed-bid dark pool: commit / cancel / reveal-and-fill, with single-contract cancel-priority | `ISequencingRights` (single-contract ACE) |
| `SentinelUnderwriter` | Autonomous parametric underwriter: rolling-window drawdown trigger, pooled payouts, on-chain settlement report | HTTP `0x0801` + JQ `0x0803` (price feed), LLM `0x0802` (settlement narrative), Scheduler (self-waking) |

A shared `PrecompileConsumer` base decodes Ritual's short-running async (SPC) envelope and guards two-phase callbacks with `msg.sender == AsyncDelivery`.

### The loop

```
seal bid ──▶ post clearing price ──▶ reveal & fill ──▶ Aegis records the fill
   │                                                          ▲
   └── cancel (higher priority, beats a same-block fill)      │
                                                              │
buy cover ──▶ price window updates ──▶ 30% drawdown trigger ──▶ settle ──▶ Aegis records the payout
```

---

## Deployed contracts (Ritual testnet, chain 1979)

| Contract | Address | Explorer |
|---|---|---|
| AegisRegistry | `0x38a9fCb26F3349910c6B3E84bdA146dDF5c08249` | [view](https://explorer.ritualfoundation.org/address/0x38a9fCb26F3349910c6B3E84bdA146dDF5c08249) |
| SilentBidPool | `0x3a605E5ceAb9870783bd33e8102d79E177Ad82b9` | [view](https://explorer.ritualfoundation.org/address/0x3a605E5ceAb9870783bd33e8102d79E177Ad82b9) |
| SentinelUnderwriter | `0xB914a815B711A52Eb908796Ad29bf7C0D358BbaC` | [view](https://explorer.ritualfoundation.org/address/0xB914a815B711A52Eb908796Ad29bf7C0D358BbaC) |

---

## On-chain proof

A complete trade-to-settlement lifecycle, executed on the live testnet. Every step is a real transaction:

| Step | Transaction |
|---|---|
| Fund underwriter pool | [`0xe3b2e9ab…f7e64`](https://explorer.ritualfoundation.org/tx/0xe3b2e9ab561c4f8cfccee5caead2f646bb69ebe39977a923d1de42b886bf7e64) |
| Buy parametric cover | [`0xe90bddd8…1748d`](https://explorer.ritualfoundation.org/tx/0xe90bddd816d57474d150dede0b714e966563f60b57d35844f4f4bda77ac1748d) |
| Seal a bid (price hidden) | [`0xb7869732…1cdc88`](https://explorer.ritualfoundation.org/tx/0xb7869732bd7707b34ff9df7ea10f688c74846242e92926fbe1c1f6eb8f1cdc88) |
| Post clearing price | [`0x723c34c7…708bce0`](https://explorer.ritualfoundation.org/tx/0x723c34c77c7df44261319ac11b658813906ec9878972aef7b3a7fa87c708bce0) |
| Reveal & fill bid | [`0x22f2499d…3a06206`](https://explorer.ritualfoundation.org/tx/0x22f2499dc46ffb3fd6e2627ccbe585f4c3d60feb0f0e9612eab83c8b38a06206) |
| Settle claim | [`0xa250d2c9…f9f59e6b`](https://explorer.ritualfoundation.org/tx/0xa250d2c9d4531b36f76a88f1ba5af3db659925ebcc3e8fceeacdf8e2f9f59e6b) |
| File settlement report | [`0x97fe12ed…d0f81c4`](https://explorer.ritualfoundation.org/tx/0x97fe12ed3a980be13bc28193630c70e0ce775650b643e1d5750d0f6cad0f81c4) |

### Live metrics (read directly from the contracts)

| Metric | Value |
|---|---|
| Sealed bids filled | 1 |
| Parametric policies underwritten | 1 |
| Drawdown trigger | fired at **36.23%** (threshold 30%) |
| Claims settled | 1 — payout released from the pool |
| Registered agents | 1 |
| Agent reputation score | **1055** (base 1000 + honored settlement + fill) |
| Foundry tests | 49 passing |
| Deployment cost | ~0.0046 RITUAL |
| Full lifecycle cost | ~0.0011 RITUAL (gas only) |

---

## Tech stack

**Contracts** — Solidity 0.8.28, [Foundry](https://book.getfoundry.sh/) (forge + cast), Ritual precompiles (`ISequencingRights`, HTTP `0x0801`, JQ `0x0803`, LLM `0x0802`, Scheduler), `RitualWallet` for prepaid precompile fees.

**Frontend** — Next.js 14 (App Router) · TypeScript · [wagmi](https://wagmi.sh/) v2 + [viem](https://viem.sh/) v2 · Tailwind CSS. A single-page trading terminal in an editorial "newsprint" design system, with a nine-state async-transaction state machine, live `useWatchContractEvent` feeds, polled reads, and a canvas price tape.

**Chain** — Ritual Chain (ID `1979`), RPC `https://rpc.ritualfoundation.org`, explorer `https://explorer.ritualfoundation.org`, faucet `https://faucet.ritualfoundation.org`.

---

## Repository layout

```
.
├── contracts/                 # Foundry project
│   ├── src/
│   │   ├── AegisRegistry.sol
│   │   ├── SilentBidPool.sol
│   │   ├── SentinelUnderwriter.sol
│   │   ├── interfaces/IRitual.sol
│   │   └── utils/PrecompileConsumer.sol
│   ├── test/                  # 49 Foundry tests
│   ├── script/Deploy.s.sol
│   └── foundry.toml
└── web/                       # Next.js frontend (Vercel-ready)
    ├── app/
    ├── components/
    ├── hooks/
    └── lib/
```

---
