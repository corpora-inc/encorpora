// Asset-free Web Audio: a struck felt-mallet timbre over a C5–C6 pentatonic,
// plus one wooden knock for the slate.
//
// ── WHAT CHANGED, AND THE ONE LINE THAT DID NOT ─────────────────────────────
//
// The founder's playtest: *"success and failure sounds need to be awesome and
// varied."* They were neither. There was exactly ONE bank cue and ONE spot cue,
// so the twentieth correct call sounded identical to the first, and a miss made
// no sound at all.
//
// Both halves are now POOLS, picked with the run's seeded RNG (`flourish.ts`
// owns the pick, so the sound and the animation are one decision and can never
// disagree). Same seed, same sequence of voices; different seeds, different runs.
//
// **A MISS NOW HAS A VOICE, AND IT IS NOT A BUZZER.** The line this file used to
// hold — "a wrong verdict makes no sound" — was written when a miss showed the
// child nothing at all. A miss now COMPLETES THE SUM in front of them, in the
// accent, held on screen, and the sound is the audio half of that: a quiet,
// RISING two-note resolution, the sound of a value settling into place. It is
// never a fall, never a dissonance, never a thud, and it is a fifth the loudness
// of the smallest celebration.
//
// The invariant that governs it has not moved a millimetre. `EXPERIENCE_DESIGN.md`
// says `energy(SLIP) < energy(SEAT)`, and `game/energy.ts` computes that from the
// numbers in this file rather than from a comment about them:
//
//     energy(dud)  = 900 × 3 × 0.045 = 121.5
//     energy(bank) = 500 × 3 × 0.20  = 300
//     energy(spot) = 940 × 4 × 0.24  = 902.4
//
// so being wrong stays, by construction, the least interesting thing that can
// happen. `energy.test.ts` fails the moment that stops being true.
//
// `lapse` is still absent, and for the reason it always was, which is the more
// important one: a tone at the end of a window a child was still thinking through
// is a buzzer aimed at slowness. There is no sound for running out of time, and
// there must never be one.

import type { Outcome } from "../game/response.ts"
import { createSafetyBus } from "../../../../packs/shared/game-audio/index.ts"

/** C5 · D5 · E5 · G5 · A5 · C6, in Hz. Exact enough; nothing compares them. */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

export type Voice = {
  /** Indices into `PENTATONIC`, struck in order. */
  readonly degrees: readonly number[]
  /** Seconds between strikes. */
  readonly spacing: number
  readonly gain: number
  readonly decay: number
  /**
   * How much octave sits over the fundamental, 0..1. The felt mallet's hardness.
   * Varying it is most of why two voices with the same notes are not the same
   * sound.
   */
  readonly bright: number
  /** Transposition in whole pentatonic steps. Lets one shape sit in two registers. */
  readonly lift?: number
}

/**
 * Every voice each outcome can speak with. `lapse` has none and must not get one.
 *
 * The pools are deliberately small — three apiece. A pool of ten is not four times
 * as varied as a pool of three, it is four times as much surface for one of them to
 * be subtly wrong on one device, and the thing a child actually notices is that the
 * game is not repeating itself.
 */
export const VOICE_POOL: Partial<Record<Outcome, readonly Voice[]>> = {
  // Banking a true claim. Struck cleanly, high, and short — the sound of a card
  // going into a pile.
  bank: [
    { degrees: [4, 5], spacing: 0.075, gain: 0.2, decay: 0.44, bright: 0.22 },
    { degrees: [3, 5], spacing: 0.068, gain: 0.19, decay: 0.5, bright: 0.3 },
    { degrees: [2, 4, 5], spacing: 0.055, gain: 0.18, decay: 0.4, bright: 0.16 },
  ],
  // Spotting a counterfeit. Warmer, longer and three notes wide, because it is the
  // harder thing to do and it is the game's one piece of applause.
  spot: [
    { degrees: [5, 2, 4], spacing: 0.12, gain: 0.24, decay: 0.9, bright: 0.26 },
    { degrees: [0, 3, 5], spacing: 0.105, gain: 0.23, decay: 1.0, bright: 0.34 },
    { degrees: [4, 5, 4, 5], spacing: 0.085, gain: 0.22, decay: 0.82, bright: 0.2, lift: -1 },
  ],
  // A miss. RISING, quiet, unhurried: the sound of the true value arriving, not of
  // a mistake being announced. Every one of these is a fifth of a bank's gain and
  // none of them descends.
  dud: [
    { degrees: [0, 2], spacing: 0.16, gain: 0.045, decay: 1.0, bright: 0.1 },
    { degrees: [0, 3], spacing: 0.185, gain: 0.042, decay: 1.1, bright: 0.08 },
    { degrees: [1, 3], spacing: 0.15, gain: 0.04, decay: 0.95, bright: 0.12 },
  ],
  burn: [
    { degrees: [0, 3], spacing: 0.16, gain: 0.045, decay: 1.0, bright: 0.1 },
    { degrees: [1, 4], spacing: 0.175, gain: 0.042, decay: 1.05, bright: 0.09 },
    { degrees: [0, 2, 4], spacing: 0.13, gain: 0.04, decay: 0.9, bright: 0.11 },
  ],
  // `lapse` has no entry, and must not get one. See above.
}

/**
 * The LOUDEST voice each outcome can speak with.
 *
 * `game/energy.ts` reads `gain` out of here to check "being wrong is never the
 * loudest thing", so it has to be told about the worst case rather than about the
 * average one — a pool whose third member was twice as loud as its first would
 * otherwise pass an invariant it breaks every third round.
 */
export const VOICES: Partial<Record<Outcome, Voice>> = Object.fromEntries(
  Object.entries(VOICE_POOL).map(([kind, pool]) => [
    kind,
    pool.reduce((loudest, v) => (v.gain > loudest.gain ? v : loudest)),
  ]),
) as Partial<Record<Outcome, Voice>>

/** How many voices this outcome can speak with. Zero when it is silent. */
export function voiceCount(outcome: Outcome): number {
  return VOICE_POOL[outcome]?.length ?? 0
}

/** The `index`th voice, wrapped. Null for the outcomes that say nothing. */
export function voiceFor(outcome: Outcome, index: number): Voice | null {
  const pool = VOICE_POOL[outcome]
  if (!pool || pool.length === 0) return null
  return pool[((index % pool.length) + pool.length) % pool.length] ?? null
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

  /**
   * The outcome, in the voice `flourish.ts` drew for it.
   *
   * `index` comes from the same seeded pick that chose the animation, so the sound
   * and the picture are one decision. `lapse` lands here and leaves.
   */
  outcome(kind: Outcome, index = 0): void {
    const voice = voiceFor(kind, index)
    if (!voice) return
    const ctx = this.context()
    const bus = this.bus
    if (!ctx || !bus) return
    const t0 = ctx.currentTime
    const lift = voice.lift ?? 0
    voice.degrees.forEach((degree, i) => {
      const step = Math.max(0, Math.min(PENTATONIC.length - 1, degree + lift))
      this.strike(ctx, bus, PENTATONIC[step] ?? 523.25, t0 + i * voice.spacing, voice)
    })
  }

  /** The run ending. One low pair, and then the street is quiet. */
  over(): void {
    const ctx = this.context()
    const bus = this.bus
    if (!ctx || !bus) return
    const t0 = ctx.currentTime
    const voice: Pick<Voice, "gain" | "decay" | "bright"> = {
      gain: 0.14,
      decay: 1.1,
      bright: 0.22,
    }
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
    voice: Pick<Voice, "gain" | "decay" | "bright">,
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
    // `GainNode.gain` defaults to 1, which at this point in the graph is the
    // fundamental's whole level again as a bare octave. It is always set.
    overtoneGain.gain.setValueAtTime(voice.bright, at)
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
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(ctx)
      bus.connect(safety.input)
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
