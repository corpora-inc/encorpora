/**
 * beatlounge — the GLOBAL transport store: ONE source of truth for `isPlaying`.
 *
 * The bug this fixes: the shell header, the Dock-Rail, and each immersive page
 * each kept their OWN `useState(audio.isPlaying())` + local toggle, so pressing
 * play in one place left the others showing the wrong icon ("play/stop gets out
 * of sync"). Now there is exactly ONE flag, in a module-scoped vanilla zustand
 * store, and EVERY play/stop button routes through it. There is no second copy
 * to desync, and no duplicate transport state.
 *
 * Re-renders are SELECTIVE: only components that read `isPlaying` (via
 * `useTransport`) re-render when it flips. This is NOT tied to the rAF playhead
 * — the flag changes once per start/stop, never per frame.
 *
 * The store deliberately does NOT import the AudioFacade: `toggle`/`stop` take
 * the facade the caller already holds and drive `audio.start()/stop()`. The
 * facade stays the audio owner; this store owns only the boolean the UI reads.
 */

import { createStore } from "zustand/vanilla"
import { useStore } from "zustand"
import type { AudioFacade } from "../contracts/audioFacade"

interface TransportState {
  isPlaying: boolean
}

/** Module singleton — there is one transport per pack instance. */
const transportStore = createStore<TransportState>(() => ({ isPlaying: false }))

/** Set the global flag directly (idempotent — no churn when unchanged). */
export const setTransportPlaying = (isPlaying: boolean): void => {
  if (transportStore.getState().isPlaying !== isPlaying) {
    transportStore.setState({ isPlaying })
  }
}

/** Read the current flag outside React (e.g. for an initial value). */
export const isTransportPlaying = (): boolean => transportStore.getState().isPlaying

/**
 * Seed the global flag from the facade's truth. Call once when a fresh facade
 * is wired up so the UI reflects reality (the facade starts stopped, but this
 * keeps the store honest if that ever changes).
 */
export const syncTransportFromAudio = (audio: AudioFacade): void => {
  setTransportPlaying(audio.isPlaying())
}

/** Drive the facade AND the flag together — the one start path. */
export const startTransport = (audio: AudioFacade): Promise<void> => {
  setTransportPlaying(true)
  return Promise.resolve(audio.start()).catch((err) => {
    // Roll the flag back if the engine refused to start.
    setTransportPlaying(audio.isPlaying())
    throw err
  })
}

/** Drive the facade AND the flag together — the one stop path. */
export const stopTransport = (audio: AudioFacade): void => {
  audio.stop()
  setTransportPlaying(false)
}

export interface TransportControl {
  isPlaying: boolean
  toggle: () => void
}

/**
 * The hook every transport button uses. Subscribes to the single global flag
 * (selective re-render) and returns a `toggle` that flips audio + flag through
 * the one path. Pass the AudioFacade the component already holds.
 */
export const useTransport = (audio: AudioFacade): TransportControl => {
  const isPlaying = useStore(transportStore, (s) => s.isPlaying)
  const toggle = (): void => {
    if (transportStore.getState().isPlaying) {
      stopTransport(audio)
    } else {
      void startTransport(audio).catch((err) =>
        console.warn("[beatlounge/transport] start failed:", err)
      )
    }
  }
  return { isPlaying, toggle }
}

/** Test seam: reset the singleton between specs. */
export const __resetTransportForTest = (): void => {
  transportStore.setState({ isPlaying: false })
}
