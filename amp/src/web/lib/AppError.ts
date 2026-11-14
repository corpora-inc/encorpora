export type ErrorKind =
  | "authentication"
  | "permission"
  | "validation"
  | "unavailable"
  | "network"
  | "contract";
export class AppError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly retry: boolean,
    readonly requestId: string | null = null,
    /** The server's machine-readable error code, when it sent one. */
    readonly code: string | null = null,
    readonly status: number | null = null,
    /** Paths only, never values or messages from the rejected request. */
    readonly validationPaths:
      readonly (readonly (string | number)[])[] | null = null,
    /** The server's own refusal, for a screen that says more than the code
     * (who holds a buyer link, say). Never the request's values. */
    readonly body: unknown = null,
  ) {
    super(message);
    this.name = "AppError";
  }
  log() {
    console.error("AMP action failed", {
      kind: this.kind,
      message: this.message,
      requestId: this.requestId,
      code: this.code,
    });
  }
}

/** An answer the server refused: the thing is gone for this person (a
 * revoked role, a removed class), unlike a passing network failure. */
export const refused = (error: unknown) =>
  error instanceof AppError &&
  (error.status === 401 || error.status === 403 || error.status === 404);

/** A query's answer as it stands: undefined until answered, null once the
 * server refused it. A refusal revokes the cached answer, whatever it said
 * (no cached "open" or capability outlives the server's no, CP-3 r6); a
 * refetch that failed otherwise keeps the last answer. */
export function standing<T>(query: {
  data: T | undefined;
  error: unknown;
  isError: boolean;
}): T | null | undefined {
  return query.isError && refused(query.error) ? null : query.data;
}
