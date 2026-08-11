import { describe, it, expect } from 'vitest'
import { checkAddress, isValidAddressShape } from '../src/address.js'
import { MOCK_ADDRESS } from './mock-wallet.js'

const b58 = (n: number) => 'V'.repeat(n)

describe('checkAddress', () => {
  it('accepts standard-length bx addresses', () => {
    expect(checkAddress(MOCK_ADDRESS)).toEqual({ valid: true, kind: 'standard' })
    expect(checkAddress('bx' + b58(93))).toEqual({ valid: true, kind: 'standard' }) // 95
    expect(checkAddress('bx' + b58(95))).toEqual({ valid: true, kind: 'standard' }) // 97
  })

  it('accepts integrated-length addresses', () => {
    expect(checkAddress('bx' + b58(104))).toEqual({ valid: true, kind: 'integrated' }) // 106
  })

  it('rejects bad shapes', () => {
    expect(checkAddress('').valid).toBe(false)
    expect(checkAddress('T6' + b58(93)).valid).toBe(false)          // wrong prefix
    expect(checkAddress('bx' + 'O'.repeat(93)).valid).toBe(false)   // 'O' not base58
    expect(checkAddress('bx' + b58(93) + '0').valid).toBe(false)    // '0' not base58
    expect(checkAddress('bx' + b58(50)).valid).toBe(false)          // too short
    expect(checkAddress('bx' + b58(150)).valid).toBe(false)         // too long
  })

  it('boolean helper agrees', () => {
    expect(isValidAddressShape(MOCK_ADDRESS)).toBe(true)
    expect(isValidAddressShape('nope')).toBe(false)
  })
})
