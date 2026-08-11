import { createRoot } from 'react-dom/client'
import { BeldexProvider, ConnectButton, useConnect, useBalance, fromAtomic } from 'bdx-web3js/react'

function Balance() {
  const { isConnected } = useConnect()
  const { balance, error } = useBalance({ pollMs: 15000 })
  if (!isConnected) return null
  if (error) return <p style={{ color: '#ff5c5c' }}>balance error: {error.message}</p>
  if (!balance) return <p>loading balance…</p>
  return (
    <p>
      Spendable: <b style={{ color: '#3EC745' }}>{fromAtomic(balance.unlocked)} BDX</b>
      {balance.approximate ? ' (approx.)' : ''}
    </p>
  )
}

function App() {
  return (
    <BeldexProvider>
      <h1 style={{ fontSize: 18 }}>◆ bdx-web3js React demo</h1>
      <ConnectButton />
      <Balance />
      <p style={{ color: '#8a8a8a', fontSize: 12 }}>
        Requires the Beldex Wallet extension. Serve over http(s) — the extension
        does not inject into file:// pages.
      </p>
    </BeldexProvider>
  )
}

createRoot(document.getElementById('root')).render(<App />)
