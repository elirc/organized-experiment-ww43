/**
 * Defines typed application errors so middleware can translate domain failures
 * into stable HTTP responses.
 * Called by validation helpers, services, and route middleware.
 * A junior engineer often throws raw Error objects and loses important status
 * and error-code context by the time the request reaches the client.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ⚠️ SENIOR NOTE: Stable machine-readable codes matter once multiple clients or
// background jobs depend on the same API contract.
export const appError = (
  message: string,
  statusCode: number,
  code: string,
  details?: unknown,
) => new AppError(message, statusCode, code, details);
