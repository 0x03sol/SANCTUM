# Security

SANCTUM runs on the **Ritual testnet** (chain 1979). All RITUAL is free testnet currency with no real-world value. Nothing here has been audited; do not reuse in production without review.

## Reporting

Found an issue? Open a private report via GitHub Security Advisories on this repository, or open an issue for non-sensitive findings. Please do not disclose exploitable issues publicly before a fix.

## Properties enforced by the contracts

- **Callback authentication.** Every two-phase async callback verifies `msg.sender == AsyncDelivery` (`0x5A16214fF555848411544b005f7Ac063742f39F6`) and is idempotent (a per-job `fulfilled` flag), so results cannot be injected or replayed.
- **Reputation is gated.** Only contracts authorized via `AegisRegistry.setReporter` can write fills, premiums, payouts, or defaults. Agents cannot inflate their own score.
- **TOCTOU-safe settlement.** `SentinelUnderwriter.settle()` re-checks the drawdown trigger and the `settled` latch at execution time, and never pays more than `poolBalance`.
- **Cancel-priority.** `SilentBidPool` declares `cancelBid` at a higher sequencing level than `revealAndFill`; a block that orders a fill before a same-block cancel is invalid.
- **Sealed bids.** Prices are committed as `keccak256(abi.encode(maxPrice, salt))` and never written on-chain until reveal, so they cannot be read from the mempool.
- **Custom errors, checks-effects-interactions, and explicit access modifiers** throughout.

## Secrets

- `PRIVATE_KEY`, `.env`, wallet keystores, and Foundry `broadcast/` / `cache/` artifacts are git-ignored and never committed.
- The frontend only consumes `NEXT_PUBLIC_*` values (public RPC + contract addresses). No private key is ever shipped to the client or to Vercel.

## Known limitations

- Multi-contract ACE (cross-contract cancel-priority) is not yet available on the chain; SANCTUM uses the single-contract subset.
- The reveal salt is stored client-side; clearing local storage means an open bid must wait for expiry.
