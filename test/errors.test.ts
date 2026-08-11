import { describe, it, expect } from 'vitest'
import { BdxRpcError, ERROR_CODES, toBdxError } from '../src/errors.js'

describe('BdxRpcError', () => {
  it('carries code and is instanceof Error', () => {
    const e = new BdxRpcError(4001, 'nope')
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe(4001)
    expect(e.name).toBe('BdxRpcError')
  })

  it('classification helpers', () => {
    expect(BdxRpcError.isUserRejection(new BdxRpcError(ERROR_CODES.USER_REJECTED, ''))).toBe(true)
    expect(BdxRpcError.isLocked(new BdxRpcError(ERROR_CODES.WALLET_LOCKED, ''))).toBe(true)
    expect(BdxRpcError.isUnauthorized(new BdxRpcError(ERROR_CODES.UNAUTHORIZED, ''))).toBe(true)
    expect(BdxRpcError.isExpired(new BdxRpcError(ERROR_CODES.REQUEST_EXPIRED, ''))).toBe(true)
    expect(BdxRpcError.isUserRejection(new Error('4001'))).toBe(false)
    expect(BdxRpcError.isUserRejection(null)).toBe(false)
  })
})

describe('toBdxError', () => {
  it('passes BdxRpcError through', () => {
    const e = new BdxRpcError(4100, 'x')
    expect(toBdxError(e)).toBe(e)
  })
  it('lifts {code,message} shapes', () => {
    const e = toBdxError({ code: 4900, message: 'locked' })
    expect(e).toBeInstanceOf(BdxRpcError)
    expect(e.code).toBe(4900)
  })
  it('wraps everything else as internal', () => {
    expect(toBdxError(new Error('boom')).code).toBe(ERROR_CODES.INTERNAL)
    expect(toBdxError('boom').code).toBe(ERROR_CODES.INTERNAL)
    expect(toBdxError({ code: 'not-a-number', message: 'x' }).code).toBe(ERROR_CODES.INTERNAL)
  })
})
