import { errorDetails } from "../../analytics/error-details";
import { AppError } from "./AppError";
import { screenOf, trackClientError } from "./analytics";

/**
 * Failure handling (docs/architecture/frontend-patterns.md, "Errors"). No
 * catch swallows: it reports and shows, or it rethrows.
 *
 * - `reportError(error, context)` logs a failure with what was being done and
 *   returns the words to show for it, inline or in a toast
 *   (`ui/useErrorToast`).
 * - `reported(context, fallback)` is a `.catch` handler for work whose
 *   failure the person needn't see (a preload the screen asks again, a
 *   best-effort extra): logged, then the fallback.
 * - `ifNotFound(value)` is a `.catch` handler for a read where "none" is a
 *   real answer: a 404 becomes `value`; any other failure still rejects.
 * - `jsonOrNull(response)` reads a body that may not be JSON.
 */

/** What was being done, in a few plain words ("save the class name"), or
 * that with what to say when the error has no words of its own and details
 * worth logging (ids and codes, never what a person typed). */
export type ErrorContext =
  | string
  | {
      doing: string;
      fallback?: string;
      details?: Record<string, string | number | boolean | null | undefined>;
    };

/** Said for a failure that is ours (a bug), not the server's or the network's. */
export const UNEXPECTED =
  "Something went wrong on our side. Reload the page and try again.";

/** A request cancelled on purpose (a screen left, a newer request): no
 * failure, nothing to say. */
export const isAborted = (error: unknown) =>
  (error instanceof DOMException || error instanceof Error) &&
  error.name === "AbortError";

/** The server says the thing isn't there. */
export const isNotFound = (error: unknown): error is AppError =>
  error instanceof AppError && error.status === 404;

/** The words to show for a failure, without logging it: for a query's
 * `error`, which the request already logged. Empty for a cancelled
 * request, which shows nothing (a `Toast` with no message is closed). */
export function messageFor(error: unknown, fallback = UNEXPECTED): string {
  if (isAborted(error)) return "";
  if (error instanceof AppError) return error.message || fallback;
  return fallback;
}

/** Logs a failure with its context and returns the words to show for it. */
export function reportError(error: unknown, context: ErrorContext): string {
  const { doing, fallback, details } =
    typeof context === "string" ? { doing: context } : context;
  const message = messageFor(error, fallback);
  if (isAborted(error)) return message;
  const app = error instanceof AppError ? error : null;
  console.error(`AMP couldn’t ${doing}`, {
    ...details,
    kind: app?.kind ?? "unexpected",
    code: app?.code ?? null,
    status: app?.status ?? null,
    requestId: app?.requestId ?? null,
    error,
  });
  // The server and the network report their own failures (lib/api.ts logs
  // each AppError); anything else is ours, so it is counted with the app's
  // other errors.
  if (!app)
    trackClientError({
      ...errorDetails(error, undefined, location.origin),
      kind: "error",
      screen: screenOf(location.pathname),
    });
  return message;
}

/** A `.catch` handler that reports the failure, then resolves to
 * `fallback`: `.catch(reported("preload the roster", undefined))`. */
export const reported =
  <T>(context: ErrorContext, fallback: T) =>
  (error: unknown): T => {
    reportError(error, context);
    return fallback;
  };

/** A `.catch` handler for a read where "not there" is an answer:
 * `.catch(ifNotFound(null))`. Any other failure still rejects. */
export const ifNotFound =
  <T>(value: T) =>
  (error: unknown): T => {
    if (isNotFound(error)) return value;
    throw error;
  };

/** A response body as JSON, or null when it isn't JSON (an empty or HTML
 * error page). A dropped connection or a cancel still rejects. */
export async function jsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
