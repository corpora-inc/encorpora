import { requestFetch, requestWith } from "./request-transport";

/** `fetch` with `keepalive`, so a send can outlive the page. A webview that
 * refuses the option by throwing still gets an ordinary request, and the
 * caller always gets a promise, never a synchronous throw. */
export function keepaliveFetch(
  input: string,
  init: RequestInit,
): Promise<Response> {
  return requestWith(
    () => {
      try {
        return fetch(input, { ...init, keepalive: true });
      } catch {
        return Promise.resolve().then(() => requestFetch(input, init));
      }
    },
    {
      method: init.method ?? "GET",
      token: new Headers(init.headers)
        .get("authorization")
        ?.match(/^Bearer\s+(.+)$/i)?.[1],
    },
  );
}
