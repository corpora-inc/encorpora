type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>

type GlobalWithTauri = typeof globalThis & {
  __TAURI__?: {
    core?: { invoke?: TauriInvoke }
    invoke?: TauriInvoke
  }
}

const getTauriInvoke = (): TauriInvoke | null => {
  const t = (globalThis as GlobalWithTauri).__TAURI__
  if (!t) return null
  if (t.core?.invoke) return t.core.invoke.bind(t.core)
  if (t.invoke) return t.invoke.bind(t)
  return null
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

export type ResolvedAsset = { effective: string; dispose: () => void }

/**
 * Resolve a pack asset URL to one that fetch/XHR/decodeAudioData can load.
 *
 * iOS WebKit's fetch rejects the `corpan-pack://` scheme even though the
 * protocol handler serves <script src> fine. Workaround: ask Tauri to read
 * the bytes via `content_packs_fetch_bytes` and wrap them in a Blob URL.
 * Outside Tauri (vite dev), the URL is returned unchanged.
 */
export const loadPackAssetUrl = async (url: string): Promise<ResolvedAsset> => {
  const invoke = getTauriInvoke()
  if (invoke && isCorpanPackUrl(url)) {
    const protocolUrl = toCorpanPackProtocolUrl(url)
    const bytes = (await invoke("content_packs_fetch_bytes", {
      url: protocolUrl,
    })) as ArrayBuffer
    const blob = new Blob([bytes], { type: guessMime(url) })
    const blobUrl = URL.createObjectURL(blob)
    return {
      effective: blobUrl,
      dispose: () => URL.revokeObjectURL(blobUrl),
    }
  }
  return { effective: url, dispose: () => {} }
}
