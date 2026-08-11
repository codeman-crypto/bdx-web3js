// Protocol error codes (PROTOCOL.md §6) and the SDK error class.

export const ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  WALLET_LOCKED: 4900,
  NO_WALLET: 4901,
  REQUEST_EXPIRED: 4999,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export class BdxRpcError extends Error {
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'BdxRpcError'
    this.code = code
    // Restore prototype chain when targeting ES5-transpiled environments.
    Object.setPrototypeOf(this, new.target.prototype)
  }

  /** User declined or closed the approval window — not an app error. */
  static isUserRejection(e: unknown): boolean {
    return e instanceof BdxRpcError && e.code === ERROR_CODES.USER_REJECTED
  }

  /** Wallet is locked/unavailable — prompt the user to open the wallet. */
  static isLocked(e: unknown): boolean {
    return e instanceof BdxRpcError && e.code === ERROR_CODES.WALLET_LOCKED
  }

  /** Origin holds no grant — call connect() first. */
  static isUnauthorized(e: unknown): boolean {
    return e instanceof BdxRpcError && e.code === ERROR_CODES.UNAUTHORIZED
  }

  /** Approval TTL or SDK timeout elapsed — safe to retry. */
  static isExpired(e: unknown): boolean {
    return e instanceof BdxRpcError && e.code === ERROR_CODES.REQUEST_EXPIRED
  }
}

/** Normalize anything a provider throws/returns into a BdxRpcError. */
export function toBdxError(e: unknown): BdxRpcError {
  if (e instanceof BdxRpcError) return e
  if (
    typeof e === 'object' && e !== null &&
    typeof (e as { code?: unknown }).code === 'number' &&
    typeof (e as { message?: unknown }).message === 'string'
  ) {
    return new BdxRpcError((e as { code: number }).code, (e as { message: string }).message)
  }
  return new BdxRpcError(ERROR_CODES.INTERNAL, e instanceof Error ? e.message : String(e))
}
