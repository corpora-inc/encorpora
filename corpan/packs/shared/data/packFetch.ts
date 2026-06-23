/**
 * Tauri-aware fetch utilities for corpan-pack:// URLs.
 *
 * When running inside the Corpan host app, zip-installed packs use
 * corpan-pack:// URLs which can't be fetched via the browser fetch() API.
 * These helpers detect that scheme and route through Tauri IPC instead.
 * In dev mode (no Tauri), they fall through to regular fetch().
 */

export function withRevision(url: string, revision?: string): string {
  if (!revision || url.startsWith("corpan-pack://")) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}v=${encodeURIComponent(revision)}`
}

const tauriInvoke = (): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | undefined =>
  (window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } })
    .__TAURI_INTERNALS__?.invoke

export async function packFetchJson(url: string): Promise<unknown> {
  const invoke = tauriInvoke()
  if (invoke) {
    const text = (await invoke("content_packs_fetch_text", { url })) as string
    return JSON.parse(text)
  }
  // Fallback: browser fetch (standalone dev mode, no Tauri)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
  return resp.json()
}

export async function packFetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const invoke = tauriInvoke()
  if (invoke) {
    const raw = await invoke("content_packs_fetch_bytes", { url })
    // Tauri invoke may return Uint8Array, plain array, or ArrayBuffer depending on platform
    if (raw instanceof ArrayBuffer) return raw
    // Tauri bytes are never SharedArrayBuffer-backed; narrow the slice result.
    if (ArrayBuffer.isView(raw)) return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
    return new Uint8Array(raw as number[]).buffer
  }
  // Fallback: browser fetch (standalone dev mode, no Tauri)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
  return resp.arrayBuffer()
}
