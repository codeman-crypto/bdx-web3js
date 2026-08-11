# bdx-web3js

Typed SDK for connecting web apps to the **Beldex Wallet** browser extension — connect, read the address and balance, and initiate transactions the user approves in the wallet, MetaMask-style.

Zero runtime dependencies. ESM + CJS + browser global builds. Amounts are BigInt end-to-end (1 BDX = 10⁹ atomic units — floats are never trusted).

> Protocol spec: [`PROTOCOL.md`](./PROTOCOL.md) · Roadmap: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md)

## Install

```bash
npm install bdx-web3js
```

Or as a browser global: `<script src="…/bdx-web3.global.js"></script>` → `window.BdxWeb3`.

## Quickstart

```ts
import { BeldexWeb3, detectProvider, toAtomic, fromAtomic } from 'bdx-web3js'

const provider = await detectProvider({ timeoutMs: 3000 })
if (!provider) {
  // Extension not installed — show an "Install Beldex Wallet" CTA.
  return
}
const bdx = new BeldexWeb3(provider)

// Connect (opens the wallet's approval UI; idempotent once granted)
const { address, network } = await bdx.connect()

// Balance — BigInt atomic units; format with fromAtomic()
const { unlocked, approximate } = await bdx.getBalance()
console.log(`spendable: ${fromAtomic(unlocked)} BDX${approximate ? ' (approx.)' : ''}`)

// Send — the user reviews and approves inside the wallet
try {
  const { txHash, fee } = await bdx.sendTransaction({
    to: 'bx…',                  // resolve BNS names first (see below)
    amount: toAtomic('1.25'),   // display BDX → atomic units
    priority: 5                 // 1 default … 5 flash (instant)
  })
  console.log('sent', txHash, 'fee', fromAtomic(fee))
} catch (e) {
  if (BeldexWeb3.isUserRejection(e)) {
    // user said no — not an error state
  } else throw e
}

// Events
bdx.on('accountsChanged', () => {/* wallet switched — call connect() again */})
bdx.on('balanceChanged', d => {/* refresh UI */})
bdx.on('disconnect', () => {/* show connect button */})
```

### BNS names

`sendTransaction` accepts only concrete addresses — resolve names first so users approve exactly what gets paid:

```ts
const { address } = await bdx.resolveBns('shop.bdx')
// ALWAYS show `address` to the user before sending — resolution is not
// verified on-chain (verified: false).
```

### Error handling

All failures throw `BdxRpcError` with a protocol `code`:

| Code | Meaning | Suggested UX |
|---|---|---|
| 4001 | User rejected | Neutral UI, no error toast |
| 4100 | Not connected | Call `connect()` |
| 4900 | Wallet locked | "Open your Beldex Wallet to continue" |
| 4901 | No wallet created | Point to wallet onboarding |
| 4999 | Request/approval expired or timed out | Safe to retry |
| -32602 | Invalid params | Developer bug — check the message |
| -32603 | Internal wallet error | Retry later |

Helpers: `BeldexWeb3.isUserRejection(e)`, `.isLocked(e)`, `.isUnauthorized(e)`.

### Utilities

```ts
toAtomic('1.25')            // 1250000000n  (display BDX → atomic)
fromAtomic(1250000000n)     // '1.25'       (atomic → display BDX)
checkAddress('bx…')         // { valid, kind: 'standard' | 'integrated', reason? }
```

`checkAddress` validates **shape only** (base58, `bx` prefix, length) — the wallet fully re-validates every address before signing.

## What a dapp can and cannot do

Beldex is a private-by-default (Monero-family) chain, so this SDK is payments-oriented, and everything sensitive is permissioned:

- Balances aren't public — `getBalance()` works only after the user approves `connect()`, and is answered by the wallet itself. Your app never sees the view key.
- Every `sendTransaction`/`signMessage` requires fresh in-wallet approval. There are no allowances or auto-approvals.
- Before `connect()`, a page can only learn that a wallet exists (`getState()`).

## API surface

`detectProvider(opts?)` · `new BeldexWeb3(provider, opts?)` · `connect()` · `disconnect()` · `getAddress()` · `getBalance()` · `sendTransaction(params)` · `signMessage(msg)` · `verifyMessage(params)` · `resolveBns(name)` · `getNetwork()` · `getState()` · `on/off/once(event, fn)` · `address` / `isConnected` getters.

Events: `connect`, `disconnect`, `accountsChanged`, `networkChanged`, `balanceChanged`, `lock`, `unlock`.

## Development

```bash
npm install
npm run build       # dist/: ESM + CJS + IIFE + .d.ts
npm test            # vitest (jsdom) against a mock wallet
npm run typecheck
```

`examples/vanilla.html` runs against an inline mock wallet — open it after `npm run build` to try the full connect → balance → send flow with no extension installed. The mock steps aside automatically when the real extension is present.

## Status

Phase 1 of the roadmap (SDK core). The extension-side dapp bridge (Phase 2+) is required for real end-to-end use — see `IMPLEMENTATION_PLAN.md`.
