import { AppError } from "./AppError";
import {
  currentSessionToken,
  isRenewing,
  isRetired,
} from "./session-generation";

export type RequestOptions = {
  token?: string | null;
  body?: unknown;
  signal?: AbortSignal;
  method?: string;
  headers?: Record<string, string>;
};
export const requestMethod = (options: RequestOptions) =>
  (
    options.method ?? (options.body === undefined ? "GET" : "POST")
  ).toUpperCase();

/** A retryable local refusal: no transport or mutation has started. */
export class SessionUnconfirmedError extends AppError {
  constructor() {
    super(
      "authentication",
      "One moment, confirming your sign-in",
      true,
      null,
      "session_unconfirmed",
    );
    this.name = "SessionUnconfirmedError";
  }
}

export function replacedSession() {
  return new AppError(
    "authentication",
    "This was asked by a sign-in that has since changed.",
    false,
    null,
    "session_replaced",
  );
}

/** Every transport shares this boundary, including cookie-authenticated calls.
 * Reads keep /me and recovery available. Refused writes are never queued: the
 * person can retry with their preserved draft after /me confirms the renewal. */
export async function requestWith<T>(
  sending: () => Promise<T>,
  options: RequestOptions = {},
): Promise<T> {
  const token = options.token ?? currentSessionToken();
  if (isRetired(token)) throw replacedSession();
  if (
    requestMethod(options) !== "GET" &&
    (isRenewing(currentSessionToken()) || isRenewing(token))
  )
    throw new SessionUnconfirmedError();
  const answer = await sending();
  if (isRetired(token)) throw replacedSession();
  return answer;
}

/** Raw-response adapter for downloads and legacy/custom response contracts.
 * Method and bearer identity come from the actual fetch arguments, so callers
 * cannot forget separate guard options. Cookie requests use the current session. */
export function requestFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const original =
    typeof Request !== "undefined" && input instanceof Request
      ? input
      : undefined;
  const headers = new Headers(init.headers ?? original?.headers);
  const authorization = headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  return requestWith(() => fetch(input, init), {
    token,
    method: init.method ?? original?.method ?? "GET",
  });
}
