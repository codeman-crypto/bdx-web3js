import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot, Root } from 'react-dom/client'
import { act } from 'react'
import { BeldexProvider, ConnectButton, useBalance, useBeldex } from '../src/react.js'
import { MockWallet, MOCK_ADDRESS } from './mock-wallet.js'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let wallet: MockWallet
let container: HTMLDivElement
let root: Root

const flush = (ms = 20) => act(() => new Promise<void>(r => setTimeout(r, ms)))

beforeEach(() => {
  wallet = new MockWallet()
  wallet.announce()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  wallet.destroy()
})

function BalanceProbe() {
  const { balance } = useBalance({ pollMs: 60_000 })
  const { address } = useBeldex()
  return (
    <div>
      <span data-testid="addr">{address ?? 'none'}</span>
      <span data-testid="bal">{balance ? balance.unlocked.toString() : 'loading'}</span>
    </div>
  )
}

describe('BeldexProvider + ConnectButton', () => {
  it('detects, connects on click, then disconnects', async () => {
    await act(async () => {
      root.render(
        <BeldexProvider detectTimeoutMs={200}>
          <ConnectButton />
        </BeldexProvider>
      )
    })
    await flush(50)
    const btn = () => container.querySelector('button')!
    expect(btn().textContent).toBe('Connect Beldex Wallet')

    await act(async () => { btn().click() })
    await flush(50)
    expect(btn().textContent).toContain(MOCK_ADDRESS.slice(0, 8))
    expect(wallet.calls.some(c => c.method === 'bdx_connect')).toBe(true)

    await act(async () => { btn().click() }) // click while connected = disconnect
    await flush(50)
    expect(btn().textContent).toBe('Connect Beldex Wallet')
  })

  it('user rejection resolves quietly (no throw, stays disconnected)', async () => {
    wallet.handlers.bdx_connect = () => { throw { code: 4001, message: 'no' } }
    await act(async () => {
      root.render(
        <BeldexProvider detectTimeoutMs={200}>
          <ConnectButton />
        </BeldexProvider>
      )
    })
    await flush(50)
    const btn = container.querySelector('button')!
    await act(async () => { btn.click() })
    await flush(50)
    expect(container.querySelector('button')!.textContent).toBe('Connect Beldex Wallet')
  })
})

describe('useBalance', () => {
  it('loads after connect and updates on balanceChanged', async () => {
    await act(async () => {
      root.render(
        <BeldexProvider detectTimeoutMs={200}>
          <ConnectButton />
          <BalanceProbe />
        </BeldexProvider>
      )
    })
    await flush(50)
    expect(container.querySelector('[data-testid="bal"]')!.textContent).toBe('loading')

    await act(async () => { container.querySelector('button')!.click() })
    await flush(50)
    expect(container.querySelector('[data-testid="addr"]')!.textContent).toBe(MOCK_ADDRESS)
    expect(container.querySelector('[data-testid="bal"]')!.textContent).toBe('10000000000')

    wallet.handlers.bdx_getBalance = () => ({
      total: '99000000000', unlocked: '99000000000', approximate: false, height: 1
    })
    await act(async () => { wallet.emit('balanceChanged', { total: '99000000000', unlocked: '99000000000', height: 1 }) })
    await flush(50)
    expect(container.querySelector('[data-testid="bal"]')!.textContent).toBe('99000000000')
  })
})
