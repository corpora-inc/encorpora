// Asset-free Web Audio: a struck felt-mallet timbre over a C5–C6 pentatonic,
// plus one wooden knock for the slate.
//
// The important entry in the table is the one that is not there. **A wild draw
// makes no sound.** Not a buzz, not a thud, not a muted click — nothing. The
// street declines to acknowledge the draw, and an audio engine that sneaked in a
// "you got it wrong" cue would undo the entire design, so `wild` is absent from
// `VOICES` and `outcome()` returns before touching the context.

import type { Outcome } from "../game/response.ts"

/** C5 · D5 · E5 · G5 · A5 · C6, in Hz. Exact enough; nothing compares them. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

type Voice = {
  /** Indices into `PENTATONIC`, struck in order. */
  readonly degrees: readonly number[]
  /** Seconds between strikes. */
  readonly spacing: number
  readonly gain: number
  readonly decay: number
}

/**
 * What each outcome sounds like. `wild` is deliberately absent — see above.
 * `game/energy.ts` reads `gain` out of here so the "being wrong is never the
 * loudest thing" invariant is checked against the real numbers rather than
 * against a comment.
 */
export const VOICES: Partial<Record<Outcome, Voice>> = {
  // Struck once, cleanly, high. The sound of being right and being quick.
  hit: { degrees: [4], spacing: 0, gain: 0.2, decay: 0.5 },
  // A bow: two notes falling. Warmer and longer than the hit, because holding
  // is the harder thing to do and this is the game's one piece of applause.
  bow: { degrees: [5, 2], spacing: 0.14, gain: 0.24, decay: 0.9 },
  // Low, short, over before you look up.
  slow: { degrees: [0], spacing: 0, gain: 0.11, decay: 0.34 },
}

export class Audio {
  private ctx: AudioContext | null = null
  private bus: GainNode | null = null
  private failed = false

  /** Web Audio needs a gesture. The first press in the game is that gesture. */
  resume(): void {
    const ctx = this.context()
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // A context that will not resume is a silent game, not a broken one.
      })
    }
  }

  /** The slate lighting: a dry wooden knock, well under the mallet voices. */
  cue(): void {
    const ctx = this.context()
    const bus = this.bus
    if (!ctx || !bus) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = "triangle"
    osc.frequency.setValueAtTime(196, t)
    osc.frequency.exponentialRampToValueAtTime(104, t + 0.06)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.09, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.17)
    osc.connect(env).connect(bus)
    osc.start(t)
    osc.stop(t + 0.2)
  }

  outcome(kind: Outcome): void {
    const voice = VOICES[kind]
    // `wild` lands here and leaves. Silence is the punishment.
    if (!voice) return
    const ctx = this.context()
    const bus = this.bus
    if (!ctx || !bus) return
    const t0 = ctx.currentTime
    voice.degrees.forEach((degree, index) => {
      this.strike(ctx, bus, PENTATONIC[degree] ?? 523.25, t0 + index * voice.spacing, voice)
    })
  }

  /** The run ending. One low pair, and then the street is quiet. */
  over(): void {
    const ctx = this.context()
    const bus = this.bus
    if (!ctx || !bus) return
    const t0 = ctx.currentTime
    const voice: Voice = { degrees: [], spacing: 0, gain: 0.14, decay: 1.1 }
    this.strike(ctx, bus, 261.63, t0, voice)
    this.strike(ctx, bus, 174.61, t0 + 0.22, voice)
  }

  dispose(): void {
    const ctx = this.ctx
    this.ctx = null
    this.bus = null
    if (ctx) {
      void ctx.close().catch(() => {
        // Closing a context that is already gone is not news.
      })
    }
  }

  /** A felt mallet: a sine fundamental with a quieter triangle octave over it. */
  private strike(
    ctx: AudioContext,
    bus: GainNode,
    hz: number,
    at: number,
    voice: Pick<Voice, "gain" | "decay">,
  ): void {
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(voice.gain, at + 0.008)
    env.gain.exponentialRampToValueAtTime(0.0001, at + voice.decay)
    env.connect(bus)

    const body = ctx.createOscillator()
    body.type = "sine"
    body.frequency.setValueAtTime(hz, at)
    body.connect(env)
    body.start(at)
    body.stop(at + voice.decay + 0.05)

    const overtone = ctx.createOscillator()
    const overtoneGain = ctx.createGain()
    overtone.type = "triangle"
    overtone.frequency.setValueAtTime(hz * 2, at)
    overtoneGain.gain.setValueAtTime(0.22, at)
    overtone.connect(overtoneGain).connect(env)
    overtone.start(at)
    overtone.stop(at + voice.decay * 0.6)
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx
    if (this.failed) return null
    const Ctor =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) {
      this.failed = true
      return null
    }
    try {
      const ctx = new Ctor()
      const bus = ctx.createGain()
      bus.gain.value = 0.9
      bus.connect(ctx.destination)
      this.ctx = ctx
      this.bus = bus
      return ctx
    } catch (error) {
      this.failed = true
      console.warn("[truedraw] no audio context", error)
      return null
    }
  }
}
