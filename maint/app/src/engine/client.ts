/**
 * The one way the app talks to the engine. Two transports behind one call:
 * HTTP (`POST /api/<method>`, the browser and development against
 * `harvest serve`) and Tauri `invoke` (the installed app). The app sends what
 * the technician entered and renders what comes back; it never decides a
 * branch, a match or a variant itself.
 */
// A relative path (not the @appkit alias) so node runs this module in tests.
import { isNative, tauriInvoke } from "../../../../harvest/appkit/src/bridge.ts";
import type { Envelope, Method, Params, Result } from "./types.ts";

export class EngineError extends Error {
  readonly code: string;
  readonly method: string;
  constructor(method: string, code: string, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.method = method;
  }
}

export interface Transport {
  call(method: string, params: unknown): Promise<Envelope<unknown>>;
}

/** `headers`: added to every call (the hub's sign-in, when a person is signed in). */
export function httpTransport(base = "", headers: () => Record<string, string> = () => ({})): Transport {
  return {
    async call(method, params) {
      let res: Response;
      try {
        res = await fetch(`${base}/api/${method}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers() }, body: JSON.stringify(params ?? {}) });
      } catch (e) {
        return { ok: false, error: { code: "unreachable", message: `The engine did not answer (${e instanceof Error ? e.message : String(e)})` } };
      }
      const body = (await res.json().catch(() => null)) as Envelope<unknown> | null;
      if (!body || typeof body !== "object" || !("ok" in body)) return { ok: false, error: { code: "internal", message: `Unexpected reply (HTTP ${res.status})` } };
      return body;
    },
  };
}

/** The installed app: the same envelope from the native `engine_call` command. */
export function tauriTransport(): Transport {
  return {
    async call(method, params) {
      const invoke = tauriInvoke();
      if (!invoke) return { ok: false, error: { code: "internal", message: "No native bridge" } };
      return (await invoke("engine_call", { method, params: params ?? {} })) as Envelope<unknown>;
    },
  };
}

let transport: Transport = isNative() ? tauriTransport() : httpTransport();

/** What the installed app found when it opened the engine (warnings); null in a browser. */
export async function shellReport(): Promise<{ warnings: string[]; device_id: string | null } | null> {
  const invoke = tauriInvoke();
  if (!invoke) return null;
  return (await invoke("shell_report")) as { warnings: string[]; device_id: string | null };
}

/** Tests and the design build swap the transport. */
export function setTransport(t: Transport): void {
  transport = t;
}

/** The engine's codes whose messages are written for a person; any other failure is said in the app's own words. */
const SPOKEN = new Set(["invalid", "unauthenticated", "forbidden", "restart_needed", "open_failed"]);

/**
 * What to tell a person about a failed call: the engine's own words only where they are written
 * for people, never a database or system error (those go to the log with `reportError`).
 */
export function plainError(e: unknown, fallback: string): string {
  if (e instanceof EngineError && SPOKEN.has(e.code) && !/sqlite|database|os error|panicked/i.test(e.message)) return e.message.replace(/^invalid input: /, "");
  return fallback;
}

/** The records changed under the running app: the app asks once for a restart (see `onRestartNeeded`). */
export const RESTART_NEEDED = "restart_needed";
let restartListener: ((message: string) => void) | null = null;
export function onRestartNeeded(fn: (message: string) => void): void {
  restartListener = fn;
}

export async function call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
  const r = await transport.call(method, params);
  if (!r.ok) {
    if (r.error.code === RESTART_NEEDED) restartListener?.(r.error.message);
    throw new EngineError(method, r.error.code, r.error.message);
  }
  return r.result as Result<M>;
}

/**
 * The hub: review and publishing, on a supervisor's or engineer's screen.
 * Same envelope, its own address (in development, /hub is proxied to it).
 */
let hubToken: string | null = null;
/** The signed-in person's bearer token for the hub (development sign-in); null signs out. */
export function setHubToken(t: string | null): void {
  hubToken = t;
}
let hubTransport: Transport = httpTransport("/hub", (): Record<string, string> => (hubToken ? { Authorization: `Bearer ${hubToken}` } : {}));
export function setHubTransport(t: Transport): void {
  hubTransport = t;
}
export async function hubCall<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
  const r = await hubTransport.call(method, params);
  if (!r.ok) throw new EngineError(method, r.error.code, r.error.message);
  return r.result as Result<M>;
}

/**
 * A figure or page image of the signed pack: from `harvest serve` over HTTP,
 * or in the installed app from the shell's `maint-asset` scheme (which the
 * Windows WebView reaches as http://maint-asset.localhost).
 */
export function assetUrl(packId: string, assetId: string): string {
  const path = `${encodeURIComponent(packId)}/${encodeURIComponent(assetId)}`;
  if (!isNative()) return `/asset/${path}`;
  const windows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
  return windows ? `http://maint-asset.localhost/${path}` : `maint-asset://localhost/${path}`;
}
