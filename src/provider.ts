// Provider discovery (PROTOCOL.md §2): namespaced EIP-6963-style handshake
// with a window.beldex fallback. SSR-safe — no window access at module load.

import type { AnnounceProviderDetail, BeldexProvider } from './types.js'
import { ANNOUNCE_PROVIDER_EVENT, REQUEST_PROVIDER_EVENT } from './types.js'

export interface DetectOptions {
  /** How long to wait for an announce before falling back / giving up. */
  timeoutMs?: number
}

function isProvider(v: unknown): v is BeldexProvider {
  return typeof v === 'object' && v !== null &&
    (v as BeldexProvider).isBeldex === true &&
    typeof (v as BeldexProvider).request === 'function' &&
    typeof (v as BeldexProvider).on === 'function' &&
    typeof (v as BeldexProvider).off === 'function'
}

function isAnnounceDetail(v: unknown): v is AnnounceProviderDetail {
  return typeof v === 'object' && v !== null &&
    isProvider((v as AnnounceProviderDetail).provider) &&
    typeof (v as AnnounceProviderDetail).info === 'object'
}

/**
 * Detect the Beldex Wallet extension. Resolves with its provider, or `null`
 * if none announced within `timeoutMs` (default 3000) — render an
 * "Install Beldex Wallet" CTA in that case instead of throwing.
 */
export function detectProvider(opts: DetectOptions = {}): Promise<BeldexProvider | null> {
  if (typeof window === 'undefined') return Promise.resolve(null) // SSR
  const timeoutMs = opts.timeoutMs ?? 3000

  return new Promise(resolve => {
    let settled = false
    const finish = (p: BeldexProvider | null) => {
      if (settled) return
      settled = true
      window.removeEventListener(ANNOUNCE_PROVIDER_EVENT, onAnnounce as EventListener)
      clearTimeout(timer)
      resolve(p)
    }

    const onAnnounce = (ev: Event) => {
      const detail = (ev as CustomEvent).detail
      if (isAnnounceDetail(detail)) finish(detail.provider)
    }

    const timer = setTimeout(() => {
      const injected = (window as { beldex?: unknown }).beldex
      finish(isProvider(injected) ? injected : null)
    }, timeoutMs)

    window.addEventListener(ANNOUNCE_PROVIDER_EVENT, onAnnounce as EventListener)
    window.dispatchEvent(new CustomEvent(REQUEST_PROVIDER_EVENT))

    // Fast path: already injected before we asked.
    const injected = (window as { beldex?: unknown }).beldex
    if (isProvider(injected)) {
      // Give announce one microtask-ish beat to win (it carries richer info),
      // then take the injected object.
      setTimeout(() => finish(injected), 0)
    }
  })
}
