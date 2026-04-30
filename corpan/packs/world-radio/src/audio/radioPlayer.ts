/**
 * Live radio player wrapped around a single HTMLAudioElement.
 *
 * Deliberately does NOT use Web Audio. Most radio Icecast/Shoutcast streams
 * don't send CORS headers, and routing the element through a Web Audio graph
 * requires CORS to access audio data — without it the stream is silenced by
 * spec. The previous attempts at "play with crossOrigin, fall back without"
 * dual-element analyser bridges, and silent-data detection all introduced
 * more glitch than they removed. Plain `<audio>` plays every station
 * reliably; the EQ glyph uses canned CSS animation, which is honest about
 * "audio is flowing" without lying about "we can read its frequencies".
 *
 * HLS + URL fallback (Android-compat fix):
 *
 *   - Android Chromium WebView has no native HLS — `canPlayType('application/
 *     vnd.apple.mpegurl')` returns "". Stations whose URL is HLS (`.m3u8` or
 *     `station.hls === 1`) are routed through hls.js (lazy-imported) on
 *     those platforms. Safari / WKWebView (macOS + iOS) plays HLS natively
 *     in `<audio>`, so we keep that path there.
 *   - When `url_resolved` is set and differs from `url`, we keep `url` as
 *     a fallback. If the primary 404s / decode-fails / stream-not-supports,
 *     we transparently try the fallback once before surfacing the error.
 *     A common failure mode is a stale `url_resolved` (DNS/CDN flake) while
 *     the original `url` still works.
 */

import type { RadioStation } from "../api/radioBrowser"
import { registerClick } from "../api/radioBrowser"
import { attachHls, needsHlsJs, isLikelyHls, type HlsAttachment } from "./hlsLoader"

export type PlayerState =
  | { kind: "idle" }
  | { kind: "loading"; station: RadioStation }
  | { kind: "playing"; station: RadioStation }
  | { kind: "paused"; station: RadioStation }
  | { kind: "error"; station: RadioStation; message: string }

export type PlayerListener = (state: PlayerState) => void

export type RadioPlayer = {
  play: (station: RadioStation) => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  stop: () => void
  setVolume: (v: number) => void
  getVolume: () => number
  getState: () => PlayerState
  subscribe: (listener: PlayerListener) => () => void
  dispose: () => void
}

export function createRadioPlayer(_initialVolume: number = 1): RadioPlayer {
  const audio = document.createElement("audio")
  audio.preload = "none"
  // Run at unity gain — user controls level via hardware volume keys.
  audio.volume = 1
  audio.style.display = "none"
  document.body.appendChild(audio)

  let state: PlayerState = { kind: "idle" }
  let lastPlayedUuid: string | null = null
  const listeners = new Set<PlayerListener>()

  // Active hls.js attachment (when current source is HLS routed through MSE).
  // Cleared whenever we change source so the previous attachment can free its
  // buffers.
  let hlsAttachment: HlsAttachment | null = null

  // Pending fallback URL for the currently-loading station. Set when we start
  // playing the primary URL; cleared once we either succeed (`playing` event)
  // or exhaust the fallback. `null` means "no fallback to try".
  let pendingFallbackUrl: string | null = null

  function disposeHls() {
    if (hlsAttachment) {
      hlsAttachment.dispose()
      hlsAttachment = null
    }
  }

  function setState(next: PlayerState) {
    state = next
    for (const l of listeners) {
      try {
        l(state)
      } catch (err) {
        console.error("[world-radio] player listener threw:", err)
      }
    }
  }

  audio.addEventListener("playing", () => {
    if (state.kind === "loading" || state.kind === "paused") {
      const station = state.station
      // Successful playback consumes the fallback option.
      pendingFallbackUrl = null
      setState({ kind: "playing", station })
      if (lastPlayedUuid !== station.stationuuid) {
        lastPlayedUuid = station.stationuuid
        void registerClick(station.stationuuid)
      }
    }
  })

  audio.addEventListener("pause", () => {
    if (state.kind === "playing" && !audio.ended) {
      setState({ kind: "paused", station: state.station })
    }
  })

  audio.addEventListener("error", () => {
    const code = audio.error?.code ?? 0
    const message = describeMediaError(audio.error)
    if (state.kind === "idle") return
    const station = "station" in state ? state.station : null
    if (!station) return

    // On decode / source-not-supported errors, try the fallback URL once
    // before surfacing the error. Common case on Android: `url_resolved`
    // points at a CDN edge that's stale or returns a Content-Type the
    // WebView refuses, while the original `url` still works.
    const isFallbackEligible = (code === 3 || code === 4) && pendingFallbackUrl !== null
    if (isFallbackEligible) {
      const fallback = pendingFallbackUrl!
      pendingFallbackUrl = null
      console.warn(
        `[world-radio] primary failed (code ${code}: ${message}), trying fallback URL`
      )
      void loadSource(station, fallback, /* isFallback */ true)
      return
    }

    console.error(`[world-radio] stream error for ${station.name}: ${message}`)
    setState({ kind: "error", station, message })
  })

  audio.addEventListener("stalled", () => {
    console.error("[world-radio] stream stalled")
  })

  // Token guards against an out-of-order play() landing after a newer one,
  // and against a stale fallback retry firing after the user changed station.
  let playToken = 0

  /**
   * Load `url` into the audio element. Routes HLS through hls.js on platforms
   * that need it. Caller is responsible for setting state to `loading` first.
   */
  async function loadSource(
    station: RadioStation,
    url: string,
    isFallback: boolean
  ): Promise<void> {
    const myToken = playToken
    disposeHls()
    if (!audio.paused) audio.pause()

    const hls = isLikelyHls(station, url)
    try {
      if (hls && needsHlsJs(audio)) {
        // Android / Chromium WebView path. attachHls handles audio.src + load
        // via MSE. We still call audio.play() to start playback once the
        // manifest is attached.
        hlsAttachment = await attachHls(audio, url, {
          onFatalError: (msg) => {
            if (myToken !== playToken) return
            // Synthesize a MediaError-style flow: fallback if available,
            // else surface to UI.
            if (state.kind !== "loading" && state.kind !== "playing") return
            const stationNow = "station" in state ? state.station : station
            if (pendingFallbackUrl) {
              const fallback = pendingFallbackUrl
              pendingFallbackUrl = null
              console.warn(
                `[world-radio] HLS primary failed (${msg}), trying fallback URL`
              )
              void loadSource(stationNow, fallback, true)
              return
            }
            setState({ kind: "error", station: stationNow, message: `HLS error: ${msg}` })
          },
        })
        if (myToken !== playToken) {
          disposeHls()
          return
        }
        await audio.play()
      } else {
        audio.src = url
        audio.load()
        await audio.play()
      }
    } catch (err) {
      if (myToken !== playToken) return
      const message = err instanceof Error ? err.message : String(err)
      // Mirror the error-listener logic for fallback eligibility on rejected
      // play() promises (e.g., NotSupportedError that the error event missed).
      if (!isFallback && pendingFallbackUrl) {
        const fallback = pendingFallbackUrl
        pendingFallbackUrl = null
        console.warn(
          `[world-radio] primary play() rejected (${message}), trying fallback URL`
        )
        void loadSource(station, fallback, true)
        return
      }
      console.error("[world-radio] play() rejected:", message)
      setState({ kind: "error", station, message })
    }
  }

  return {
    async play(station: RadioStation) {
      const primary = station.url_resolved || station.url
      if (!primary) {
        const msg = "Station has no playable URL"
        console.error("[world-radio]", msg, station)
        setState({ kind: "error", station, message: msg })
        return
      }
      // Set up the fallback before the play attempt so the error listener
      // can find it. If both URLs are the same, no fallback is meaningful.
      const fallback = station.url && station.url !== primary ? station.url : null
      pendingFallbackUrl = fallback

      ++playToken
      setState({ kind: "loading", station })
      await loadSource(station, primary, /* isFallback */ false)
    },
    pause() {
      if (state.kind === "playing" || state.kind === "loading") {
        audio.pause()
      }
    },
    async resume() {
      if (state.kind === "paused") {
        try {
          await audio.play()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error("[world-radio] resume() rejected:", message)
          setState({ kind: "error", station: state.station, message })
        }
      }
    },
    stop() {
      ++playToken
      pendingFallbackUrl = null
      disposeHls()
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      lastPlayedUuid = null
      setState({ kind: "idle" })
    },
    setVolume(v: number) {
      audio.volume = clamp01(v)
    },
    getVolume() {
      return audio.volume
    },
    getState() {
      return state
    },
    subscribe(listener: PlayerListener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    dispose() {
      ++playToken
      pendingFallbackUrl = null
      disposeHls()
      listeners.clear()
      audio.pause()
      audio.removeAttribute("src")
      audio.load()
      audio.remove()
    },
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function describeMediaError(err: MediaError | null): string {
  if (!err) return "Unknown audio error"
  switch (err.code) {
    case 1: return "Aborted"
    case 2: return "Network error"
    case 3: return "Decode error (codec not supported)"
    case 4: return "Stream not supported"
    default: return err.message || "Unknown audio error"
  }
}
