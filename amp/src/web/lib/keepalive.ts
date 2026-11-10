/** `fetch` with `keepalive`, so a send can outlive the page. A webview that
 * refuses the option by throwing still gets an ordinary request, and the
 * caller always gets a promise, never a synchronous throw. */
export function keepaliveFetch(
  input: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return fetch(input, { ...init, keepalive: true });
  } catch {
    return Promise.resolve().then(() => fetch(input, init));
  }
}
