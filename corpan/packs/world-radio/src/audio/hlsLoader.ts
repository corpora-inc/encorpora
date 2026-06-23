/**
 * Lazy-loaded hls.js bridge.
 *
 * Why this exists: Android Chromium WebView has zero native HLS support
 * (`audio.canPlayType('application/vnd.apple.mpegurl')` returns ""). Many
 * radio stations now ship HLS, especially big-network mirrors (NPR, BBC,
 * iHeartRadio, etc.). hls.js feeds the HLS playlist through Media Source
 * Extensions so a plain `<audio>` element can play it.
 *
 * Safari / WKWebView (macOS + iOS) plays HLS natively, so this module is
 * only used on platforms where `canPlayType` is empty for HLS — meaning
 * the import only fires for users who actually need it. Non-HLS users
 * never pay the bundle cost (Vite emits a separate dynamic chunk).
 */

import type Hls from "hls.js"

type HlsCtor = typeof Hls

let hlsModulePromise: Promise<HlsCtor> | null = null

function loadHlsModule(): Promise<HlsCtor> {
  if (!hlsModulePromise) {
    // The "light" build drops EME (DRM), alt audio rendering, and subtitle
    // tracks — none of which are relevant to public radio HLS streams.
    // Saves ~25% of the bundle. The package ships no .d.ts for the light
    // entry, hence the dynamic-import + cast.
    // @ts-expect-error - no published types for the light entry
    hlsModulePromise = import("hls.js/dist/hls.light.mjs").then((mod: { default: HlsCtor }) => mod.default)
  }
  return hlsModulePromise
}

export type AttachHlsOptions = {
  /** Called when hls.js reports an unrecoverable error. The disposer is
   *  also fired automatically before this. */
  onFatalError?: (message: string) => void
}

export type HlsAttachment = {
  /** Detach hls.js from the audio element and free internal buffers. */
  dispose: () => void
}

/**
 * Attach hls.js to the given `<audio>` element and start loading `url`.
 * Resolves once the manifest has parsed and `audio.play()` has been called.
 * Rejects on initial setup failure (no MSE, hls.js refusing to load).
 *
 * Caller owns the audio element's lifecycle; call `dispose()` before
 * loading a new source.
 */
export async function attachHls(
  audio: HTMLAudioElement,
  url: string,
  opts: AttachHlsOptions = {}
): Promise<HlsAttachment> {
  const Hls = await loadHlsModule()
  if (!Hls.isSupported()) {
    throw new Error("hls.js: MSE not supported on this platform")
  }

  const instance = new Hls({
    // Live audio: minimize startup latency and keep buffer modest.
    lowLatencyMode: true,
    backBufferLength: 30,
    maxBufferLength: 30,
  })

  instance.loadSource(url)
  instance.attachMedia(audio)

  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    try {
      instance.detachMedia()
      instance.destroy()
    } catch (err) {
      console.error("[world-radio] hls.js dispose failed:", err)
    }
  }

  instance.on(Hls.Events.ERROR, (_event, data) => {
    if (!data.fatal) return
    const msg = `${data.type}/${data.details}`
    console.error("[world-radio] hls.js fatal:", msg, data)
    opts.onFatalError?.(msg)
    dispose()
  })

  return { dispose }
}

/**
 * True when this platform needs hls.js to play HLS. Returns false on Safari
 * / WKWebView (which have native HLS in `<audio>`) and on platforms with no
 * MSE at all (caller should not attempt HLS).
 */
export function needsHlsJs(audio: HTMLAudioElement): boolean {
  const native = audio.canPlayType("application/vnd.apple.mpegurl")
  if (native === "probably" || native === "maybe") return false
  return typeof MediaSource !== "undefined"
}

export function isLikelyHls(station: { hls?: number }, url: string): boolean {
  if (station.hls === 1) return true
  const lower = url.toLowerCase()
  return lower.includes(".m3u8") || lower.endsWith(".m3u")
}
