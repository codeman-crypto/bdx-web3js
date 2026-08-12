// End-to-end suite: drives the BUILT Beldex Wallet extension in real Chromium
// against the vanilla example page, over the real wire protocol.
//
// Prereqs (run on a desktop machine — extensions need a real Chrome):
//   1. Build the extension:  cd ../beldex-wallet-extension && npm run build:chrome
//   2. Build the SDK:        npm run build
//   3. npm i -D puppeteer    (not a committed devDep: its Chromium download is
//                             heavyweight and blocked in some CI sandboxes)
//   4. npm run e2e
//
// Env:
//   EXTENSION_DIST  path to the built extension (default ../beldex-wallet-extension/dist)
//   E2E_HEADED=1    run headed instead of --headless=new
//
// Scope: discovery, connect approval (approve + reject), getAddress, getState,
// revoke → disconnect event. Balance/send are exercised only up to their
// protocol errors — a real LWS/testnet wallet is out of scope for CI (see
// README §e2e for the manual testnet checklist).

import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const EXT = resolve(process.env.EXTENSION_DIST ?? join(here, '../../beldex-wallet-extension/dist'))
const PORT = 8123

// Test wallet seeded straight into the extension's keyring (no WASM needed:
// SAVE_WALLET accepts the secrets; this address is shape-valid only).
const TEST_ADDRESS = 'bx' + 'V9Kj2mPq8RtW3nXbYcZdEfGhJkNpQrSsTuVwXyZabc123'.repeat(3).slice(0, 95)
const TEST_PASSWORD = 'e2e-password-123'

let failures = 0
let passes = 0
function ok(cond, name) {
  if (cond) { passes++; console.log(`  ✓ ${name}`) }
  else { failures++; console.error(`  ✗ ${name}`) }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const { default: puppeteer } = await import('puppeteer').catch(() => {
    console.error('puppeteer not installed — run: npm i -D puppeteer')
    process.exit(2)
  })

  // Static server for the example page (extension only injects on http/https).
  const server = createServer((req, res) => {
    const path = req.url === '/' ? '/examples/vanilla.html' : req.url
    try {
      const file = readFileSync(join(here, '..', path))
      res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/html')
      res.end(file)
    } catch { res.statusCode = 404; res.end('nope') }
  }).listen(PORT)

  const browser = await puppeteer.launch({
    headless: process.env.E2E_HEADED ? false : 'new',
    protocolTimeout: 60_000, // fail fast instead of hanging 180s on a stuck evaluate
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-sandbox'
    ]
  })

  try {
    // ---- discover the extension id from its service worker target ----------
    const swTarget = await browser.waitForTarget(
      t => t.type() === 'service_worker' && t.url().includes('background.js'), { timeout: 15_000 })
    const extId = new URL(swTarget.url()).host
    console.log(`extension: ${extId}`)

    // ---- seed a wallet via the extension's own message API -----------------
    const panel = await browser.newPage()
    await panel.goto(`chrome-extension://${extId}/panel.html?tab=1`)
    const saved = await panel.evaluate((secrets, password) =>
      chrome.runtime.sendMessage({ type: 'SAVE_WALLET', secrets, password, name: 'E2E Wallet' }),
      {
        mnemonic: 'e2e '.repeat(24) + 'e2e', address: TEST_ADDRESS,
        pubSpendKey: '0'.repeat(64), pubViewKey: '0'.repeat(64),
        secViewKey: '0'.repeat(64), secSpendKey: '0'.repeat(64), seed: '0'.repeat(64)
      }, TEST_PASSWORD)
    ok(saved?.ok === true, `seed test wallet (SAVE_WALLET)${saved?.ok ? '' : ` — got ${JSON.stringify(saved)}`}`)
    await panel.close()

    // ---- discovery + provider state ---------------------------------------
    const page = await browser.newPage()
    await page.goto(`http://localhost:${PORT}/examples/vanilla.html`)
    await sleep(500)
    const state = await page.evaluate(async () => {
      const p = await BdxWeb3.detectProvider({ timeoutMs: 3000 })
      if (!p) return { detected: false }
      const bdx = new BdxWeb3.BeldexWeb3(p)
      window.__bdx = bdx
      return { detected: true, state: await bdx.getState() }
    })
    ok(state.detected, 'provider discovered via announce handshake')
    ok(state.state === 'unlocked', `getState() === unlocked (got ${state.state})`)

    // ---- approval driver ---------------------------------------------------
    // Decisions are driven through the extension's own message API rather than
    // by clicking the approval UI: which surface renders (side panel vs popup)
    // is browser/headless-dependent — sidePanel.open() can "succeed" headless
    // without any clickable page — while DAPP_APPROVE/REJECT exercises the
    // identical router → grant → port → SDK path deterministically. The
    // approval UIs themselves are covered by manual/headed testing.
    const driver = await browser.newPage()
    await driver.goto(`chrome-extension://${extId}/panel.html?tab=1`)
    const decide = async approve => {
      for (let i = 0; i < 50; i++) {
        const p = await driver.evaluate(() => chrome.runtime.sendMessage({ type: 'DAPP_LIST_PENDING' }))
        if (p?.pendingReq) {
          return driver.evaluate(
            (type, reqId) => chrome.runtime.sendMessage({ type, reqId }),
            approve ? 'DAPP_APPROVE' : 'DAPP_REJECT', p.pendingReq.reqId)
        }
        await sleep(100)
      }
      throw new Error('no pending approval appeared within 5s')
    }

    // ---- connect: REJECT path ---------------------------------------------
    let connectP = page.evaluate(() =>
      window.__bdx.connect().then(r => ({ ok: true, r })).catch(e => ({ ok: false, code: e.code })))
    await decide(false)
    let res = await connectP
    ok(res.ok === false && res.code === 4001, `connect rejection → 4001 (got ${JSON.stringify(res)})`)

    // ---- connect: APPROVE path --------------------------------------------
    await sleep(300)
    connectP = page.evaluate(() =>
      window.__bdx.connect().then(r => ({ ok: true, r })).catch(e => ({ ok: false, code: e.code })))
    const decision = await decide(true)
    ok(decision?.ok === true, `DAPP_APPROVE accepted (got ${JSON.stringify(decision)})`)
    res = await connectP
    ok(res.ok === true && res.r.address === TEST_ADDRESS,
      `connect approved → address returned (got ${JSON.stringify(res)})`)

    // ---- reads ------------------------------------------------------------
    const addr = await page.evaluate(() => window.__bdx.getAddress())
    ok(addr === TEST_ADDRESS, 'getAddress() after grant')
    const idempotent = await page.evaluate(() => window.__bdx.connect())
    ok(idempotent.address === TEST_ADDRESS, 'connect() idempotent once granted (no UI)')

    // ---- invalid send params fail client-side -----------------------------
    const badSend = await page.evaluate(() =>
      window.__bdx.sendTransaction({ to: 'garbage', amount: 1n }).catch(e => e.code))
    ok(badSend === -32602, 'sendTransaction bad address → -32602')

    // ---- revoke from the wallet → disconnect event ------------------------
    const eventP = page.evaluate(() =>
      new Promise(res => { window.__bdx.on('disconnect', () => res('disconnected')) }))
    await driver.evaluate(origin =>
      chrome.runtime.sendMessage({ type: 'DAPP_REVOKE_ORIGIN', origin }), `http://localhost:${PORT}`)
    ok((await Promise.race([eventP, sleep(5000).then(() => 'timeout')])) === 'disconnected',
      'revoke in wallet → disconnect event reaches the dapp')

    console.log(`\n${passes} passed, ${failures} failed`)
  } finally {
    await browser.close()
    server.close()
  }
  process.exit(failures ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })
