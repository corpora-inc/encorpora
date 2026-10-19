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
