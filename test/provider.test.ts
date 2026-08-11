import { describe, it, expect, afterEach } from 'vitest'
import { detectProvider } from '../src/provider.js'
import { MockWallet } from './mock-wallet.js'

let wallet: MockWallet | null = null

afterEach(() => {
  wallet?.destroy()
  wallet = null
})

describe('detectProvider', () => {
  it('finds a provider via the announce handshake', async () => {
    wallet = new MockWallet()
    wallet.announce()
    const p = await detectProvider({ timeoutMs: 200 })
    expect(p).toBe(wallet.provider)
  })

  it('finds a late-announcing wallet (dapp asked first)', async () => {
    wallet = new MockWallet()
    const w = wallet
    setTimeout(() => w.announce(), 50)
    const p = await detectProvider({ timeoutMs: 500 })
    expect(p).toBe(w.provider)
  })

  it('falls back to window.beldex', async () => {
    wallet = new MockWallet()
    ;(window as { beldex?: unknown }).beldex = wallet.provider
    const p = await detectProvider({ timeoutMs: 100 })
    expect(p).toBe(wallet.provider)
  })

  it('resolves null when nothing is installed', async () => {
    const p = await detectProvider({ timeoutMs: 100 })
    expect(p).toBeNull()
  })

  it('ignores malformed announce events', async () => {
    window.dispatchEvent(new CustomEvent('beldex:announceProvider', { detail: { bogus: true } }))
    const p = await detectProvider({ timeoutMs: 100 })
    expect(p).toBeNull()
  })
})
