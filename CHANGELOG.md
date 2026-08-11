# Changelog

## 0.1.0 — 2026-08-11

First release. Protocol v1 (see `docs/PROTOCOL.md`).

### Added
- Core SDK: `detectProvider()` (EIP-6963-style `beldex:announceProvider` handshake with
  `window.beldex` fallback, SSR-safe), `BeldexWeb3` client with per-method timeouts,
  `PostMessageProvider` reference transport.
- Methods: `connect`, `disconnect`, `getAddress`, `getBalance` (BigInt atomic units),
  `sendTransaction` (user-approved in-wallet, flash priority supported), `resolveBns`,
  `getNetwork`, `getState`. Events: `connect`, `disconnect`, `accountsChanged`,
  `networkChanged`, `balanceChanged`, `lock`, `unlock`.
- `BdxRpcError` with protocol error codes (EIP-1193 conventions) and classification
  helpers (`isUserRejection`, `isLocked`, `isUnauthorized`, `isExpired`).
- Utilities: `toAtomic` / `fromAtomic` / `parseAtomic` (BigInt-exact, 1 BDX = 1e9),
  `checkAddress` (format-only shape validation).
- React bindings at `bdx-web3js/react`: `BeldexProvider`, `useBeldex`, `useConnect`,
  `useBalance`, `<ConnectButton/>` (react >=18 optional peer dependency).
- Builds: ESM + CJS + IIFE (`window.BdxWeb3`) + type declarations.
- Examples: `examples/vanilla.html` (inline mock wallet, yields to the real extension),
  `examples/react-demo` (Vite).
- E2E suite (`npm run e2e`) driving the built extension in Chromium.

### Known limitations
- `signMessage` / `verifyMessage` are reserved: the wallet's WASM core exposes no
  signing primitives yet (`docs/PHASE4_CAPABILITY_REPORT.md`); calls return `-32601`.
- `paymentId` on `sendTransaction` is rejected by the v1 wallet — use integrated addresses.
- `getBalance` may be `approximate: true` until the wallet panel has computed
  key-image-corrected figures for the session.
