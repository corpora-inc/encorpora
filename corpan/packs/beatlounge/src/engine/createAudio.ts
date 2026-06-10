/**
 * beatlounge — createBeatloungeAudio.
 *
 * WAVE-1 STUB (silent): a working AudioFacade with a real moving playhead but
 * no sound, so the shell can be built and run standalone against the real
 * import path. The audio team REPLACES this file's implementation with the
 * lookahead scheduler + audioGraph + instruments. The exported signature is
 * frozen (see ../contracts/audioFacade).
 */

import type { AudioFacade, CreateBeatloungeAudio } from "../contracts/audioFacade"
import type { CommandBus } from "../model/commandBus"
import { secondsPerTick } from "../model/timing"

export const createBeatloungeAudio: CreateBeatloungeAudio = (
  bus: CommandBus,
  ctx?: AudioContext
): AudioFacade => {
  const context =
    ctx ??
    new (globalThis.AudioContext ||
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)()

  let playing = false
  let raf = 0
  let startedAt = 0 // performance.now() ms at start
  const playheadSubs = new Set<(tick: number) => void>()

  const tickNow = (): number => {
    const doc = bus.snapshot()
    const elapsedSec = (performance.now() - startedAt) / 1000
    const ticks = elapsedSec / secondsPerTick(doc.bpm)
    const loop = doc.loopLengthTicks || 1
    return Math.floor(ticks % loop)
  }

  const frame = () => {
    if (!playing) return
    const t = tickNow()
    for (const cb of playheadSubs) cb(t)
    raf = requestAnimationFrame(frame)
  }

  return {
    async start() {
      if (context.state !== "running") {
        try {
          await context.resume()
        } catch {
          /* no gesture yet — silent stub, ignore */
        }
      }
      playing = true
      startedAt = performance.now()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      playing = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      for (const cb of playheadSubs) cb(-1)
    },
    isPlaying: () => playing,
    onPlayhead(cb) {
      playheadSubs.add(cb)
      return () => {
        playheadSubs.delete(cb)
      }
    },
    previewTrack() {
      /* silent stub */
    },
    context: () => context,
    dispose() {
      if (raf) cancelAnimationFrame(raf)
      playheadSubs.clear()
    },
  }
}
