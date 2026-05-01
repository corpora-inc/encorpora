/**
 * MediaSession glue — webview-only.
 *
 * On Tauri (iOS/Android), the `tauri-plugin-radio-stream` plugin owns the
 * lock-screen card, ICY metadata, MediaSession integration, audio focus,
 * and remote commands directly via `MPNowPlayingInfoCenter` /
 * `MPRemoteCommandCenter` (iOS) and Media3 `MediaSessionService` (Android).
 * This file is a no-op there.
 *
 * In a plain browser (`npm run dev`), this wires WebKit's
 * `navigator.mediaSession` action handlers to our player so the macOS
 * touch-bar / Now Playing card and Linux/Windows browser media keys still
 * drive playback during design iteration. Nothing more — no native plugin
 * commands fire on this path.
 */

import { hasNativeRadio } from "@shared/audio"
import type { PlayerState, RadioPlayer } from "./radioPlayer"

export type MediaSessionGlue = {
  apply: (state: PlayerState) => void
  dispose: () => void
}

export function attachMediaSession(player: RadioPlayer): MediaSessionGlue {
  // Native path: the plugin already drives every lock-screen / remote-command
  // surface end-to-end. Returning an inert glue keeps the call sites simple.
  if (hasNativeRadio()) {
    return { apply: () => {}, dispose: () => {} }
  }

  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined
  if (!ms) {
    return { apply: () => {}, dispose: () => {} }
  }

  // Dedupe play/pause taps that arrive in quick succession (shouldn't really
  // happen on the webview path, but cheap insurance).
  const REMOTE_DEDUPE_MS = 250
  let lastRemoteCmd: "play" | "pause" | null = null
  let lastRemoteAt = 0
  function dispatchRemote(cmd: "play" | "pause") {
    const now = performance.now()
    if (lastRemoteCmd === cmd && now - lastRemoteAt < REMOTE_DEDUPE_MS) return
    lastRemoteCmd = cmd
    lastRemoteAt = now
    if (cmd === "play") {
      const s = player.getState()
      if (s.kind === "paused") void player.resume()
    } else {
      player.pause()
    }
  }

  ms.setActionHandler("play", () => dispatchRemote("play"))
  ms.setActionHandler("pause", () => dispatchRemote("pause"))
  ms.setActionHandler("stop", () => player.stop())
  // No seek/skip handlers — radio is live.

  function apply(state: PlayerState) {
    if (!ms) return
    if (state.kind === "playing" || state.kind === "loading" || state.kind === "paused") {
      const station = state.station
      ms.metadata = new MediaMetadata({
        title: station.name || "Unknown station",
        artist: station.country || "",
        album: station.language || "",
        artwork: station.favicon
          ? [{ src: station.favicon, sizes: "256x256", type: "image/png" }]
          : [],
      })
      ms.playbackState = state.kind === "playing" ? "playing" : "paused"
    } else {
      ms.metadata = null
      ms.playbackState = "none"
    }
  }

  const unsub = player.subscribe(apply)

  return {
    apply,
    dispose() {
      unsub()
      ms.setActionHandler("play", null)
      ms.setActionHandler("pause", null)
      ms.setActionHandler("stop", null)
      ms.metadata = null
    },
  }
}
