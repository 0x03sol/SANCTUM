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
