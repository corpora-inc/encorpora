import { afterEach, describe, expect, it } from "vitest"
import type { AudioFacade } from "../contracts/audioFacade"
import {
  __resetTransportForTest,
  isTransportPlaying,
  setTransportPlaying,
  startTransport,
  stopTransport,
  syncTransportFromAudio,
} from "./transport"

/** A minimal AudioFacade stub that tracks its own play state. */
const makeAudio = (): AudioFacade & { started: number; stopped: number } => {
  let playing = false
  return {
    started: 0,
    stopped: 0,
    start() {
      this.started += 1
      playing = true
      return Promise.resolve()
    },
    stop() {
      this.stopped += 1
      playing = false
    },
    isPlaying: () => playing,
    onPlayhead: () => () => {},
    previewTrack: () => {},
    applyParam: () => {},
    playLiveVoice: () => undefined,
    context: () => ({}) as AudioContext,
    dispose: () => {},
  }
}

afterEach(() => __resetTransportForTest())

describe("transport — single global source of truth", () => {
  it("starts stopped and reflects start/stop on the ONE flag", async () => {
    const audio = makeAudio()
    expect(isTransportPlaying()).toBe(false)

    await startTransport(audio)
    expect(isTransportPlaying()).toBe(true)
    expect(audio.started).toBe(1)

    stopTransport(audio)
    expect(isTransportPlaying()).toBe(false)
    expect(audio.stopped).toBe(1)
  })

  it("setTransportPlaying is idempotent (no churn when unchanged)", () => {
    setTransportPlaying(true)
    expect(isTransportPlaying()).toBe(true)
    setTransportPlaying(true)
    expect(isTransportPlaying()).toBe(true)
    setTransportPlaying(false)
    expect(isTransportPlaying()).toBe(false)
  })

  it("syncTransportFromAudio seeds the flag from the facade truth", () => {
    setTransportPlaying(true) // stale flag from a previous facade
    const audio = makeAudio() // a fresh facade is stopped
    syncTransportFromAudio(audio)
    expect(isTransportPlaying()).toBe(false)
  })

  it("rolls the flag back if the engine refuses to start", async () => {
    const audio = makeAudio()
    audio.start = () => Promise.reject(new Error("no context"))
    audio.isPlaying = () => false
    await expect(startTransport(audio)).rejects.toThrow("no context")
    expect(isTransportPlaying()).toBe(false)
  })

  it("two readers see the SAME flag — no second copy to desync", () => {
    // Simulates the shell header + an immersive page both reading the singleton.
    const readerA = () => isTransportPlaying()
    const readerB = () => isTransportPlaying()
    setTransportPlaying(true)
    expect(readerA()).toBe(true)
    expect(readerB()).toBe(true)
    setTransportPlaying(false)
    expect(readerA()).toBe(false)
    expect(readerB()).toBe(false)
  })
})
