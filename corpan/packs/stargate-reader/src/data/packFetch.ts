/**
 * Tauri-aware fetch utilities for corpan-pack:// URLs.
 *
 * When running inside the Corpan host app, zip-installed packs use
 * corpan-pack:// URLs which can't be fetched via the browser fetch() API.
 * These helpers detect that scheme and route through Tauri IPC instead.
 * In dev mode (no Tauri), they fall through to regular fetch().
 */

const tauriInvoke = (): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | undefined =>
  (window as unknown as { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } })
    .__TAURI_INTERNALS__?.invoke

export async function packFetchJson(url: string): Promise<unknown> {
  const invoke = tauriInvoke()
  if (invoke && url.startsWith("corpan-pack://")) {
    const text = (await invoke("content_packs_fetch_text", { url })) as string
    return JSON.parse(text)
  }
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
  return resp.json()
}

export async function packFetchArrayBuffer(url: string): Promise<ArrayBuffer> {
  const invoke = tauriInvoke()
  if (invoke && url.startsWith("corpan-pack://")) {
    return (await invoke("content_packs_fetch_bytes", { url })) as ArrayBuffer
  }
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`)
  return resp.arrayBuffer()
}
