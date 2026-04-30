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
 */

import type { RadioStation } from "../api/radioBrowser"
import { registerClick } from "../api/radioBrowser"

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
    const message = describeMediaError(audio.error)
    if (state.kind !== "idle") {
      const station = "station" in state ? state.station : null
      if (station) {
        console.error(`[world-radio] stream error for ${station.name}: ${message}`)
        setState({ kind: "error", station, message })
      }
    }
  })

  audio.addEventListener("stalled", () => {
    console.error("[world-radio] stream stalled")
  })

  // Token guards against an out-of-order play() landing after a newer one.
  let playToken = 0

  return {
    async play(station: RadioStation) {
      const url = station.url_resolved || station.url
      if (!url) {
        const msg = "Station has no playable URL"
        console.error("[world-radio]", msg, station)
        setState({ kind: "error", station, message: msg })
        return
      }
      const myToken = ++playToken
      setState({ kind: "loading", station })
      try {
        if (!audio.paused) audio.pause()
        audio.src = url
        audio.load()
        await audio.play()
      } catch (err) {
        if (myToken !== playToken) return
        const message = err instanceof Error ? err.message : String(err)
        console.error("[world-radio] play() rejected:", message)
        setState({ kind: "error", station, message })
      }
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
