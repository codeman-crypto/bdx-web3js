// Offline, format-only validation of Beldex addresses.
//
// This checks SHAPE (base58 alphabet, 'bx' prefix, plausible length) — it does
// NOT verify the embedded checksum or prove the address is spendable. Full
// validation requires the wallet's crypto core; the wallet re-validates every
// address it is asked to send to.
//
// Observed shapes (beldex-core-cpp, mainnet):
//   standard   'bx…'  ~95–97 chars
//   subaddress 'bx…'  same length band as standard
//   integrated 'bx…'  longer (~106–108 chars, embeds an 8-byte payment ID)

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/ // Monero/Bitcoin base58: no 0 O I l

const STANDARD_MIN = 95
const STANDARD_MAX = 99
const INTEGRATED_MIN = 104
const INTEGRATED_MAX = 110

export type AddressKind = 'standard' | 'integrated'

export interface AddressCheck {
  valid: boolean
  /** Present when valid. 'standard' covers subaddresses too (format-identical). */
  kind?: AddressKind
  reason?: string
}

export function checkAddress(address: string): AddressCheck {
  if (typeof address !== 'string' || address.length === 0) {
    return { valid: false, reason: 'empty' }
  }
  const s = address.trim()
  if (!s.startsWith('bx')) return { valid: false, reason: 'must start with "bx"' }
  if (!BASE58_RE.test(s)) return { valid: false, reason: 'contains non-base58 characters' }
  if (s.length >= STANDARD_MIN && s.length <= STANDARD_MAX) return { valid: true, kind: 'standard' }
  if (s.length >= INTEGRATED_MIN && s.length <= INTEGRATED_MAX) return { valid: true, kind: 'integrated' }
  return { valid: false, reason: `unexpected length ${s.length}` }
}

/** Convenience boolean form of checkAddress(). */
export function isValidAddressShape(address: string): boolean {
  return checkAddress(address).valid
}
