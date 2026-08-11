// BDX ⇄ atomic-unit conversion. 1 BDX = 1e9 atomic units. BigInt-only —
// amounts exceed IEEE-754 float precision, so floats are rejected wherever
// they could lose value.

export const ATOMIC_PER_BDX = 1_000_000_000n
export const BDX_DECIMALS = 9

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/

/**
 * Convert display BDX ("1.25", 1.25, 2n) to atomic units (bigint).
 * - string: decimal BDX, ≤ 9 fractional digits, no sign/exponent
 * - number: must be finite, non-negative, ≤ 9 decimal places, and small enough
 *   that its decimal rendering is exact (SAFE_INTEGER guard)
 * - bigint: whole BDX
 */
export function toAtomic(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new RangeError('amount must not be negative')
    return value * ATOMIC_PER_BDX
  }

  let s: string
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('amount must be finite')
    if (value < 0) throw new RangeError('amount must not be negative')
    if (value > Number.MAX_SAFE_INTEGER) throw new RangeError('amount too large for a number — pass a string')
    s = value.toString()
    if (s.includes('e') || s.includes('E')) {
      throw new RangeError('amount not exactly representable — pass a string')
    }
  } else {
    s = value.trim()
  }

  const m = DECIMAL_RE.exec(s)
  if (!m) throw new RangeError(`invalid BDX amount: "${s}"`)
  const whole = m[1]!
  const frac = m[2] ?? ''
  if (frac.length > BDX_DECIMALS) {
    throw new RangeError(`BDX supports at most ${BDX_DECIMALS} decimal places (got "${s}")`)
  }
  return BigInt(whole) * ATOMIC_PER_BDX + BigInt(frac.padEnd(BDX_DECIMALS, '0') || '0')
}

/**
 * Convert atomic units (bigint, or integer string as used on the wire) to a
 * display BDX string. Exact; trailing fractional zeros trimmed ("1.25", "3").
 */
export function fromAtomic(value: bigint | string): string {
  let v: bigint
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value.trim())) throw new RangeError(`invalid atomic amount: "${value}"`)
    v = BigInt(value.trim())
  } else {
    if (value < 0n) throw new RangeError('amount must not be negative')
    v = value
  }
  const whole = v / ATOMIC_PER_BDX
  const frac = (v % ATOMIC_PER_BDX).toString().padStart(BDX_DECIMALS, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : whole.toString()
}

/** Parse a wire amount (integer string of atomic units) to bigint. */
export function parseAtomic(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new RangeError(`invalid atomic amount: "${value}"`)
  return BigInt(value)
}
