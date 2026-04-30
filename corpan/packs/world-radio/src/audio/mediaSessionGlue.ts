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
 */

import {
  startNativeKeepAlive,
  stopNativeKeepAlive,
  updateNativeNowPlaying,
  pauseNativeKeepAlive,
  listenForRemoteCommands,
} from "@shared/audio"
import type { PlayerState, RadioPlayer } from "./radioPlayer"

export type MediaSessionGlue = {
  apply: (state: PlayerState) => void
  dispose: () => void
}

export function attachMediaSession(player: RadioPlayer): MediaSessionGlue {
  const ms = typeof navigator !== "undefined" ? navigator.mediaSession : undefined

  if (ms) {
    ms.setActionHandler("play", () => {
      const s = player.getState()
      if (s.kind === "paused") void player.resume()
    })
    ms.setActionHandler("pause", () => player.pause())
    ms.setActionHandler("stop", () => player.stop())
    // No seek/skip handlers — radio is live.
  }

  const removeRemoteListener = listenForRemoteCommands({
    onPlay: () => {
      const s = player.getState()
      if (s.kind === "paused") void player.resume()
    },
    onPause: () => player.pause(),
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
      void updateNativeNowPlaying(
        s.name,
        s.country || s.language || "",
        0,
        0,
        state.kind === "playing"
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
