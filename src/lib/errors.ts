export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE';
export class BusinessError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'VALIDATION',
  ) {
    super(message);
  }
}
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode };
