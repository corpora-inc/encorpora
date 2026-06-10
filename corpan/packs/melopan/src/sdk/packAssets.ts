/**
 * Resolve a pack asset URL to one fetch/XHR/decodeAudioData can load.
 *
 * iOS WebKit blocks fetch/XHR against custom protocols like
 * corpan-pack://, even though <script src> works fine. The corpan host
 * exposes a Tauri command (`content_packs_fetch_bytes`) that reads the
 * file off disk and returns bytes; we wrap those in a Blob URL.
 *
 * Mirrors `packs/shared/data/packFetch.ts:packFetchArrayBuffer`, which
 * is the canonical implementation used by world-radio etc. We inline
 * the same logic here to avoid wiring up the @shared/* vite alias for
 * a single helper.
 */

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

const tauriInvoke = (): TauriInvoke | undefined => {
  const internals = (
    window as unknown as { __TAURI_INTERNALS__?: { invoke?: TauriInvoke } }
  ).__TAURI_INTERNALS__
  return internals?.invoke
}

const isCorpanPackUrl = (url: string): boolean =>
  url.startsWith("corpan-pack://") || url.includes("corpan-pack.localhost")

const toCorpanPackProtocolUrl = (url: string): string => {
  try {
    if (url.startsWith("corpan-pack://")) return url
    const parsed = new URL(url)
    if (parsed.hostname === "corpan-pack.localhost") {
      return `corpan-pack://localhost${parsed.pathname}`
    }
  } catch {
    // ignore parse errors
  }
  return url
}

const guessMime = (url: string): string => {
  const ext = url.split(".").pop()?.toLowerCase()
  if (ext === "wav") return "audio/wav"
  if (ext === "ogg") return "audio/ogg"
  if (ext === "mp3") return "audio/mpeg"
  if (ext === "m4a" || ext === "aac") return "audio/mp4"
  return "application/octet-stream"
}

// Tauri invoke may return Uint8Array, plain number[], or ArrayBuffer
// depending on platform. Normalize to ArrayBuffer.
const normalizeBytes = (raw: unknown): ArrayBuffer => {
  if (raw instanceof ArrayBuffer) return raw
  if (ArrayBuffer.isView(raw)) {
    return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  }
  return new Uint8Array(raw as number[]).buffer
}

export type ResolvedAsset = {
  effective: string
  dispose: () => void
  /** Diagnostic: how this was resolved. Surfaced in the debug overlay. */
  via: "tauri-bytes" | "direct" | "no-tauri-fallback"
  bytes?: number
}

export const loadPackAssetUrl = async (url: string): Promise<ResolvedAsset> => {
  const invoke = tauriInvoke()
  if (invoke && isCorpanPackUrl(url)) {
    const protocolUrl = toCorpanPackProtocolUrl(url)
    const raw = await invoke("content_packs_fetch_bytes", { url: protocolUrl })
    const bytes = normalizeBytes(raw)
    const blob = new Blob([bytes], { type: guessMime(url) })
    const blobUrl = URL.createObjectURL(blob)
    return {
      effective: blobUrl,
      dispose: () => URL.revokeObjectURL(blobUrl),
      via: "tauri-bytes",
      bytes: bytes.byteLength,
    }
  }
  if (!invoke && isCorpanPackUrl(url)) {
    // Inside corpan-app but Tauri global not available — return the original
    // URL so the debug overlay surfaces this case clearly. fetch() will fail.
    return { effective: url, dispose: () => {}, via: "no-tauri-fallback" }
  }
  return { effective: url, dispose: () => {}, via: "direct" }
}
