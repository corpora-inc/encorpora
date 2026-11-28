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

export function httpTransport(base = ""): Transport {
  return {
    async call(method, params) {
      let res: Response;
      try {
        res = await fetch(`${base}/api/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params ?? {}) });
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

/** Tests and the design build swap the transport. */
export function setTransport(t: Transport): void {
  transport = t;
}

export async function call<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
  const r = await transport.call(method, params);
  if (!r.ok) throw new EngineError(method, r.error.code, r.error.message);
  return r.result as Result<M>;
}

/**
 * The hub: review and publishing, on a supervisor's or engineer's screen.
 * Same envelope, its own address (in development, /hub is proxied to it).
 */
let hubTransport: Transport = httpTransport("/hub");
export function setHubTransport(t: Transport): void {
  hubTransport = t;
}
export async function hubCall<M extends Method>(method: M, params: Params<M>): Promise<Result<M>> {
  const r = await hubTransport.call(method, params);
  if (!r.ok) throw new EngineError(method, r.error.code, r.error.message);
  return r.result as Result<M>;
}

/** A figure or page image of the signed pack. */
export const assetUrl = (packId: string, assetId: string) => `/asset/${encodeURIComponent(packId)}/${encodeURIComponent(assetId)}`;
