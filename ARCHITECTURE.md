# Architecture

SANCTUM is three single-responsibility contracts and a Next.js terminal, deployed on Ritual Chain (ID 1979).

## Contracts

| Contract | Responsibility | Key state |
|---|---|---|
| `AegisRegistry` | Identity + reputation ledger. Authorized market contracts report fills, premiums, payouts, settlements, and defaults; a deterministic `score()` is derived from them. | `mapping(address => Agent)`, `isReporter` |
| `SilentBidPool` | Sealed-bid dark pool. Bids are stored as `keccak256(price, salt)` commitments; cancel-priority is declared to the builder via `ISequencingRights`; fills happen on reveal against a posted clearing price. | `bids`, `clearingPrice`, `isMatcher` |
| `SentinelUnderwriter` | Autonomous parametric underwriter. Maintains a rolling price window, fires a pure-arithmetic drawdown trigger, and settles all active policies from its pool. Integrates HTTP + JQ price feeds, the LLM precompile for settlement narratives, and the Scheduler for self-waking. | `policies`, `poolBalance`, `triggered`, `settled` |

`utils/PrecompileConsumer.sol` is a shared base: it decodes Ritual's short-running async (SPC) envelope (`_executeSPC`) and gates two-phase callbacks with `msg.sender == AsyncDelivery` plus an idempotency guard.

## Access control (least privilege)

- `AegisRegistry.setReporter` authorizes only the pool and the underwriter to write reputation.
- `SilentBidPool.setMatcher` authorizes who may post clearing prices (in production, a scheduled price-fetch consumer).
- `SentinelUnderwriter` gates `recordPrice` to oracles, `wakeUp` to the Scheduler, and admin to the owner.

## The market loop

```
                 ┌───────────────────────── SilentBidPool ─────────────────────────┐
 trader ── seal bid (keccak256(price,salt)) ─▶ open ── reveal ─▶ fill ─┐
                 │           ▲                                          │           │
                 │           └── cancel (priority > reveal, same block) │           │
                 └──────────────────────────────────────────────────────┼──────────┘
                                                                         ▼
                                                                  AegisRegistry
                                                                  (records fill)
                                                                         ▲
                 ┌──────────────────────── SentinelUnderwriter ──────────┼──────────┐
 holder ── buy cover ─▶ pool ── price window ─▶ 30% drawdown trigger ─▶ settle ─────┘
                                                                  (records payout)
```

## Ritual primitives used

| Primitive | Where | Purpose |
|---|---|---|
| `ISequencingRights` (single-contract ACE) | `SilentBidPool.sequencingRights()` | Cancel ordered before reveal in the same block — front-run protection enforced at block validity. |
| HTTP `0x0801` + JQ `0x0803` | `SentinelUnderwriter.fetchAndRecordPrice` | Fetch and parse the asset price on-chain, no oracle middleware. |
| LLM `0x0802` | `SentinelUnderwriter.postSettlementReport` | Generate a human-readable settlement narrative on-chain. |
| Scheduler | `SentinelUnderwriter.wakeUp` | Self-waking price checks with no keeper. |
| RitualWallet | fee escrow | Prepays short/long-running precompile fees. |

## Frontend data flow

```
user action ─▶ wagmi writeContract ─▶ tx ─▶ useAsyncTransaction (9-state machine)
contract events ─▶ useWatchContractEvent ─▶ live ticker + activity
contract views  ─▶ useReadContracts (polled) ─▶ panels (pool, positions, reputation, report)
```

The trigger decision is pure arithmetic; the LLM is used only for the narrative, so settlement correctness never depends on non-deterministic output.
