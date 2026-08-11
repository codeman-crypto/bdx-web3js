# Phase 4 Capability Report — message signing in `@bdxi/beldex-app-bridge` v3.0.0

**Date:** 2026-08-11 · **Verdict: DEFER `bdx_signMessage` / `bdx_verifyMessage`** · Fee estimation: **implemented** (bonus finding)

## Method

Enumerated the complete JS-callable surface of the WASM crypto core the extension ships
(`@bdxi/beldex-app-bridge@3.0.0`): every `Module.*` call site in the bridge's JS classes
(`MyMoneroCoreBridgeEssentialsClass.js`, `MyMoneroLibAppBridgeClass.js`), cross-checked
against the embind-registered symbol strings inside `BeldexLibAppCpp_WASM.wasm` (3.4 MB).

## Findings

### Exposed to JS (the complete callable surface)

`newly_created_wallet` · `seed_and_keys_from_mnemonic` · `address_and_keys_from_seed` ·
`mnemonic_from_seed` · `are_equal_mnemonics` · `decode_address` · `is_integrated_address` ·
`is_subaddress` · `new_integrated_address` · `new_payment_id` · `generate_key_image` ·
`validate_components_for_login` · `estimated_tx_network_fee` · `send_funds` (+ its
`send_cb_*` / `fromCpp__SendFundsFormSubmission__*` callback machinery).

### NOT exposed to JS

- **No message sign/verify of any kind.** The wasm *contains* `generate_signature`,
  `check_signature`, `generate_tx_proof`, and `generate_ring_signature` internally
  (used by transaction construction / proof code), but none are embind-registered —
  they are unreachable from JavaScript.
- **No general-purpose primitives** (keccak, ed25519 scalar ops) that a wallet-standard
  message-signing scheme could be safely composed from. `generate_key_image` is
  fixed-purpose (tx pubkey → key image derivation) and cannot be repurposed as a signer.

## Decision

Per the phase gate ("do not hand-roll crypto primitives in JS — propose deferring"):
`bdx_signMessage` and `bdx_verifyMessage` are **deferred**. The wallet answers both with
`-32601 methodNotFound`, which the SDK surfaces cleanly; the methods stay in the SDK and
PROTOCOL.md (marked *reserved*) so no wire change is needed when support lands.

### Unblock path

Rebuild `beldex-core-cpp` / `beldex-utils` with two additional embind exports —
Monero-convention message signing (keccak domain-separated hash, ed25519 signature with
the spend key, `SigV2` encoding, as in `wallet2::sign_message` / `verify_message`) —
publish as `@bdxi/beldex-app-bridge` v3.1, then wire the already-specced protocol
methods through the existing approval flow (~2 days of extension/SDK work).
This requires a change in the upstream Beldex repos; it cannot be done from the
extension codebase alone.

## Bonus finding — real fee estimation (implemented in Phase 4)

`estimated_tx_network_fee(fee_per_kb, priority, fee_per_b?, fee_per_o?, fork_version?)`
IS exposed. The send-approval card now fetches the live per-byte fee rate from the LWS
(`/get_unspent_outs` → `per_byte_fee`/`per_kb_fee`) and shows a real WASM-computed
estimate before the user approves, replacing the static "≈ 0.02–0.05 BDX" heuristic
(which remains the fallback when the rate fetch fails).

## BNS status

`bdx_resolveBns` already conforms to PROTOCOL.md §4.8 (`verified: false`, trust caveats
documented) — no changes needed.
