/**
 * MediaSession + native lock-screen wiring.
 *
 * Why no silent anchor: our `<audio>` element is the actively-playing media
 * element, which is exactly what WebKit MediaSession needs. The shared
 * `mediaSessionAnchor` is meant for Web-Audio-only readers that have no
 * HTMLMediaElement; we don't need it here.
 *
 * Native side: when running inside Tauri (iOS/Android), we tell the native
 * audio-keepalive plugin about the current station so the lock-screen "now
 * playing" card shows artwork + name, and we listen for remote play/pause
 * commands forwarded by the native MediaSession.
 *
 * Two delivery paths from native → JS on Android:
 *   1. `window.__readerCmd('pause')` via WebView.evaluateJavascript — the
 *      direct, reliable path the readers use.
 *   2. Tauri channel events via `listenForRemoteCommands` — the structured
 *      path. On iOS the plugin only fires interruption/route events here;
 *      lock-screen play/pause is handled by WebKit's `navigator.mediaSession`.
 *
 * We wire both. A small dedupe prevents the dual paths from double-firing.
 */

import {
  startNativeKeepAlive,
  stopNativeKeepAlive,
  updateNativeNowPlaying,
  pauseNativeKeepAlive,
  listenForRemoteCommands,
} from "@shared/audio"
import type { PlayerState, RadioPlayer } from "./radioPlayer"

declare global {
  interface Window {
    __readerCmd?: (cmd: string) => void
  }
}

export type MediaSessionGlue = {
  apply: (state: PlayerState) => void
  dispose: () => void
}

export function attachMediaSession(player: RadioPlayer): MediaSessionGlue {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined

  // Dedupe play/pause that arrive on both delivery paths within a small window.
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

  if (ms) {
    ms.setActionHandler("play", () => dispatchRemote("play"))
    ms.setActionHandler("pause", () => dispatchRemote("pause"))
    ms.setActionHandler("stop", () => player.stop())
    // No seek/skip handlers — radio is live.
  }

  const previousReaderCmd = window.__readerCmd
  window.__readerCmd = (cmd: string) => {
    if (cmd === "play" || cmd === "pause") dispatchRemote(cmd)
  }

  const removeRemoteListener = listenForRemoteCommands({
    onPlay: () => dispatchRemote("play"),
    onPause: () => dispatchRemote("pause"),
    onInterruptionBegan: () => player.pause(),
    onInterruptionEnded: (shouldResume) => {
      if (shouldResume) void player.resume()
    },
  })

  let nativeStarted = false

  function applyNative(state: PlayerState) {
    if (state.kind === "playing" || state.kind === "loading") {
      const s = state.station
      if (!nativeStarted) {
        void startNativeKeepAlive(s.name, s.country || "", s.language || "")
        nativeStarted = true
      }
      // Treat "loading" as playing on the native card. The user pressed play;
      // showing a play icon mid-buffer is wrong, and on Android the service
      // guards `handlePauseCommand` on `isPlaying=true` — telling it false
      // here would silently swallow a lock-screen pause tap during buffering.
      void updateNativeNowPlaying(
        s.name,
        s.country || s.language || "",
        0,
        0,
        true
      )
    } else if (state.kind === "paused") {
      void pauseNativeKeepAlive("user-pause")
    } else if (state.kind === "idle") {
      if (nativeStarted) {
        void stopNativeKeepAlive()
        nativeStarted = false
      }
    }
  }

  function apply(state: PlayerState) {
    if (ms) {
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
    applyNative(state)
  }

  const unsub = player.subscribe(apply)

  return {
    apply,
    dispose() {
      unsub()
      removeRemoteListener?.()
      if (previousReaderCmd) {
        window.__readerCmd = previousReaderCmd
      } else {
        delete window.__readerCmd
      }
      if (ms) {
        ms.setActionHandler("play", null)
        ms.setActionHandler("pause", null)
        ms.setActionHandler("stop", null)
        ms.metadata = null
      }
      if (nativeStarted) {
        void stopNativeKeepAlive()
        nativeStarted = false
      }
    },
  }
}
