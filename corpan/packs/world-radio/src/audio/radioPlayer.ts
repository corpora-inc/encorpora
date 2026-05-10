/**
 * Live radio player — native-or-webview façade.
 *
 * On Tauri (iOS/Android), all playback is routed through
 * `tauri-plugin-radio-stream` (ExoPlayer / AVPlayer). The plugin owns the
 * lock-screen card, ICY/Shoutcast metadata, audio focus, headphone-disconnect,
 * and background reliability — none of which a WebView `<audio>` element
 * can deliver dependably for hours of screen-locked listening.
 *
 * In a plain browser (`npm run dev` for design iteration), playback falls
 * back to a single HTMLAudioElement with hls.js for HLS on Android-class
 * WebViews, plus a `url_resolved → url` retry on `MediaError` 3/4.
 *
 * Both paths expose the same `RadioPlayer` API; UI code does not branch.
 *
 * Why no Web Audio anywhere: most radio Icecast/Shoutcast streams omit CORS
 * headers, and routing the element through a Web Audio graph requires CORS
 * to read the bytes — without it the stream is silenced by spec. We accept
 * that the EQ glyph is canned animation in browser-dev; the native path
 * could later expose a level meter, but that's deferred.
 */

import type { RadioStation } from "../api/radioBrowser"
import { registerClick } from "../api/radioBrowser"
import { attachHls, needsHlsJs, isLikelyHls, type HlsAttachment } from "./hlsLoader"
import {
  listenForRadioEvents,
  probeNativeRadio,
  radioPause,
  radioPlay,
  radioResume,
  radioSetVolume,
  radioStop,
  type RadioIcyMetadata,
  type RadioStateChange,
} from "@shared/audio"

export type PlayerState =
  | { kind: "idle" }
  | { kind: "loading"; station: RadioStation }
  | { kind: "playing"; station: RadioStation }
  | { kind: "paused"; station: RadioStation }
  | { kind: "error"; station: RadioStation; message: string }

export type PlayerListener = (state: PlayerState) => void

/** Now-playing metadata from ICY/Shoutcast. Empty object once between
 *  stations and any time the source has no metadata. */
export type IcyInfo = {
  /** Track / show title from `Icy-Title` (Shoutcast `StreamTitle`). */
  title?: string
  /** Optional URL the broadcaster wants the player to display. */
  url?: string
  /** Genre tag from the headers. */
  genre?: string
}

export type IcyListener = (info: IcyInfo) => void

export type RadioPlayer = {
  play: (station: RadioStation) => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  stop: () => void
  setVolume: (v: number) => void
  getVolume: () => number
  getState: () => PlayerState
  /** Returns the most recent ICY metadata seen for the current station, or
   *  an empty object if none / not supported on this platform. */
  getIcy: () => IcyInfo
  subscribe: (listener: PlayerListener) => () => void
  /** Subscribe to ICY metadata changes. Browser-dev returns an empty info
   *  immediately and never fires again; native path fires on every
   *  StreamTitle update. */
  subscribeIcy: (listener: IcyListener) => () => void
  dispose: () => void
}

export async function createRadioPlayer(
  _initialVolume: number = 1,
): Promise<RadioPlayer> {
  // Probe asks the host whether `tauri-plugin-radio-stream` is registered.
  // True on Corpan ≥ 0.12.0, false in browser dev and on older Corpan
  // builds that ship Tauri but no plugin (where every native invoke would
  // otherwise reject with "command not found"). Defense-in-depth alongside
  // the catalog-side `minAppVersion` gate.
  const useNative = await probeNativeRadio()
  return useNative ? createNativeRadioPlayer() : createWebViewRadioPlayer()
}

// ────────────────────────────────────────────────────────────────────────────
// Native path — Tauri plugin owns the player.

function createNativeRadioPlayer(): RadioPlayer {
  let state: PlayerState = { kind: "idle" }
  let icy: IcyInfo = {}
  let currentStation: RadioStation | null = null
  let lastClickedUuid: string | null = null
  let volume = 1
  const listeners = new Set<PlayerListener>()
  const icyListeners = new Set<IcyListener>()

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

  function setIcy(next: IcyInfo) {
    icy = next
    for (const l of icyListeners) {
      try {
        l(icy)
      } catch (err) {
        console.error("[world-radio] icy listener threw:", err)
      }
    }
  }

  const removeEventListeners = listenForRadioEvents({
    onState: (s: RadioStateChange) => {
      const station = currentStation
      if (!station) {
        if (s.kind === "idle") setState({ kind: "idle" })
        return
      }
      switch (s.kind) {
        case "idle":
          setState({ kind: "idle" })
          currentStation = null
          break
        case "loading":
        case "buffering":
          // Both surface as "loading" in the UI — we don't have a separate
          // visual state for mid-stream rebuffering and don't need one.
          setState({ kind: "loading", station })
          break
        case "playing":
          setState({ kind: "playing", station })
          if (lastClickedUuid !== station.stationuuid) {
            lastClickedUuid = station.stationuuid
            void registerClick(station.stationuuid)
          }
          break
        case "paused":
          setState({ kind: "paused", station })
          break
        case "error":
          setState({
            kind: "error",
            station,
            message: s.message ?? "Stream error",
          })
          break
      }
    },
    onIcyMetadata: (m: RadioIcyMetadata) => {
      const next: IcyInfo = {}
      if (m.streamTitle) next.title = m.streamTitle
      if (m.streamUrl) next.url = m.streamUrl
      if (m.genre) next.genre = m.genre
      setIcy(next)
    },
    onRemoteCommand: (cmd) => {
      // Native plugin already mutates its player; we only need to keep our
      // local PlayerState in sync if the plugin doesn't fire a state-changed
      // for the remote command (it generally does, so this is belt-and-braces).
      if (cmd === "headphones-noisy" && state.kind === "playing") {
        // The native side has already paused; our state-changed listener
        // will pick it up. No-op here.
      }
    },
    onInterruption: (info) => {
      // Plugin pauses on .began and resumes (if shouldResume) on .ended.
      // Our state-changed listener picks up the resulting transitions.
      if (info.began) {
        // No-op — the native side handles pause.
      }
    },
  })

  return {
    async play(station: RadioStation) {
      const primary = station.url_resolved || station.url
      if (!primary) {
        const msg = "Station has no playable URL"
        console.error("[world-radio]", msg, station)
        setState({ kind: "error", station, message: msg })
        return
      }
      currentStation = station
      // Reset ICY for the new station so stale metadata doesn't linger.
      setIcy({})
      setState({ kind: "loading", station })
      try {
        await radioPlay({
          url: primary,
          stationName: station.name,
          country: station.country || undefined,
          language: station.language || undefined,
          faviconUrl: station.favicon || undefined,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error("[world-radio] native play rejected:", message)
        setState({ kind: "error", station, message })
      }
    },
    pause() {
      if (state.kind === "playing" || state.kind === "loading") {
        void radioPause()
      }
    },
    async resume() {
      if (state.kind === "paused") {
        try {
          await radioResume()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (currentStation) {
            setState({ kind: "error", station: currentStation, message })
          }
        }
      }
    },
    stop() {
      void radioStop()
      currentStation = null
      lastClickedUuid = null
      setIcy({})
      setState({ kind: "idle" })
    },
    setVolume(v: number) {
      volume = clamp01(v)
      void radioSetVolume(volume)
    },
    getVolume() {
      return volume
    },
    getState() {
      return state
    },
    getIcy() {
      return icy
    },
    subscribe(listener: PlayerListener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    subscribeIcy(listener: IcyListener) {
      icyListeners.add(listener)
      listener(icy)
      return () => icyListeners.delete(listener)
    },
    dispose() {
      removeEventListeners?.()
      void radioStop()
      listeners.clear()
      icyListeners.clear()
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// WebView path — HTMLAudioElement + hls.js + url_resolved/url fallback.
// Used in `npm run dev` for browser-based design iteration. The HLS gap on
// Android-class Chromium and the HE-AAC v2 / `audio/aacp` gap remain in this
// path (both are why we have the native plugin in the first place).

function createWebViewRadioPlayer(): RadioPlayer {
  const audio = document.createElement("audio")
  audio.preload = "none"
  audio.volume = 1
  audio.style.display = "none"
  document.body.appendChild(audio)

  let state: PlayerState = { kind: "idle" }
  let lastPlayedUuid: string | null = null
  const listeners = new Set<PlayerListener>()
  const icyListeners = new Set<IcyListener>()

  let hlsAttachment: HlsAttachment | null = null
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

    const isFallbackEligible = (code === 3 || code === 4) && pendingFallbackUrl !== null
    if (isFallbackEligible) {
      const fallback = pendingFallbackUrl!
      pendingFallbackUrl = null
      console.warn(
        `[world-radio] primary failed (code ${code}: ${message}), trying fallback URL`
      )
      void loadSource(station, fallback, true)
      return
    }

    console.error(`[world-radio] stream error for ${station.name}: ${message}`)
    setState({ kind: "error", station, message })
  })

  audio.addEventListener("stalled", () => {
    console.error("[world-radio] stream stalled")
  })

  let playToken = 0

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
        hlsAttachment = await attachHls(audio, url, {
          onFatalError: (msg) => {
            if (myToken !== playToken) return
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
      const fallback = station.url && station.url !== primary ? station.url : null
      pendingFallbackUrl = fallback
      ++playToken
      setState({ kind: "loading", station })
      await loadSource(station, primary, false)
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
    getIcy() {
      // Browser path can't read ICY metadata — `<audio>` doesn't expose it
      // and the streams aren't CORS-friendly enough to fetch via Web Audio.
      return {}
    },
    subscribe(listener: PlayerListener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    subscribeIcy(listener: IcyListener) {
      // Track the listener for symmetry with the native path, but never fire.
      icyListeners.add(listener)
      listener({})
      return () => icyListeners.delete(listener)
    },
    dispose() {
      ++playToken
      pendingFallbackUrl = null
      disposeHls()
      listeners.clear()
      icyListeners.clear()
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
