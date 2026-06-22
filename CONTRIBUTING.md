# Contributing

Thanks for your interest in SANCTUM.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/) (forge, cast)
- Node.js 20+
- A wallet funded from the [Ritual faucet](https://faucet.ritualfoundation.org)

## Setup

```bash
git clone --recurse-submodules https://github.com/0x03sol/SANCTUM.git
cd SANCTUM

# contracts
cd contracts && forge build && forge test

# frontend
cd ../web && npm install && npm test && npm run build
```

If you cloned without `--recurse-submodules`, run `git submodule update --init` to fetch `forge-std`.

## Workflow

1. Branch from `main` (`feat/…`, `fix/…`, `docs/…`, `test/…`).
2. Keep changes focused; one concern per PR.
3. Run `forge test` and `npm test` before opening a PR.
4. Open a pull request against `main`. CI must pass.

## Conventions

- **Solidity** 0.8.28, custom errors over revert strings, NatSpec on public functions, checks-effects-interactions.
- **TypeScript** strict mode; reads via `useReadContracts`, writes via the `useAsyncTransaction` hook.
- **Design** follows the newsprint system: sharp corners, the ink/paper/editorial-red/positive-green token set, and the anti-AI-slop rules. Keep red for negative/caution and green for positive states.
- Commit messages are short and imperative (`add …`, `fix …`, `refine …`).

## Tests

- Contract tests live in `contracts/test/*.t.sol` (unit + fuzz). Mock precompiles with `vm.mockCall` and simulate callbacks with `vm.prank(ASYNC_DELIVERY)`.
- Frontend tests live next to the code as `*.test.ts` and run under Vitest.
