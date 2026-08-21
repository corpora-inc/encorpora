/**
 * How a `game-soundscape` voice is actually made to sound.
 *
 * `game-soundscape` owns the music and states, in its own header, that there is
 * "no Web Audio in any of" its seven files. That is the right boundary and it
 * leaves a hole: every pack that adopts the soundscape has to write the same
 * oscillator graph, and the first one that did — THE STEELYARD — wrote a good
 * one privately, where the second pack could only copy it. Two copies of a
 * synthesiser is two answers to "how loud is a bell", which is the thing this
 * whole directory exists to have exactly one of.
 *
 * So the recipe lives here, next to the ceiling it has to fit under. A game
 * hands over a voice and a destination; nothing else about the game is visible
 * from this file, and no pitch, mode or gesture is decided in it.
 *
 * ## The two halves, and why they are separate
 *
 * `voiceGrains` is pure arithmetic — the complete list of oscillators a voice
 * costs, with their frequencies, peaks and times. `playVoice` builds nodes from
 * it. Everything worth asserting about loudness and brightness is a property of
 * the first, so `voices.test.ts` measures the real numbers a device would hear
 * without needing an `AudioContext`, a user gesture, or a device.
 *
 * ## What "premium" and "chill" mean here, in numbers
 *
 * The founder: *"maybe a whole pass on making the sound effects more premium
 * (and chillaxed in most cases) .. they tend to be a bit abrasive .. maybe lower
 * pitched in a lot of cases."* Three constants carry that:
 *
 *   - `TONE_CEILING_HZ` (2.4 kHz) — nothing pitched is allowed to be brighter,
 *     which keeps every voice out of the 2–5 kHz band the ear is most sensitive
 *     in. That band IS what "abrasive" means.
 *   - `RUBBLE_CEILING_HZ` (1.4 kHz) — and a collapse is kept lower still.
 *   - `MIN_ATTACK` (from `ceiling.ts`) — no onset may be a step function. The
 *     click on a 1 ms attack is most of what a child hears as "too loud".
 *
 * ## Timbres
 *
 * The four `game-soundscape` names, and this file must implement all four or it
 * does not compile against a `Voice` — which is the point of `VoiceTimbre`
 * being a literal union rather than `string`.
 */

import { MIN_ATTACK, safeAttack } from "./ceiling.ts"

/**
 * The timbres `game-soundscape` can ask for.
 *
 * Deliberately re-declared rather than imported. This module must not depend on
 * the music module — the dependency runs the other way in spirit and neither
 * direction is needed in fact, because a `Voice` is structurally assignable to
 * `PlayableVoice`. And the re-declaration is load-bearing: if `game-soundscape`
 * adds a fifth timbre and this file does not, every call site passing a `Voice`
 * stops compiling, which is exactly the notice a synthesiser wants.
 */
export type VoiceTimbre = "bell" | "pluck" | "bloom" | "rubble"

/** What a game hands over. Structurally `game-soundscape`'s `Voice`. */
export type PlayableVoice = {
  readonly hz: number
  readonly at: number
  readonly seconds: number
  readonly gain: number
  readonly timbre: VoiceTimbre
}

/** One oscillator. A pitched voice is a few of these at once; rubble is many, staggered. */
export type Grain = {
  /** Seconds after the voice's own `at`. */
  readonly at: number
  readonly hz: number
  /** Where the pitch glides to by `at + glideSeconds`. Equal to `hz` when it does not glide. */
  readonly glideTo: number
  readonly glideSeconds: number
  /** Linear peak, after the caller's `scale`. */
  readonly peak: number
  readonly attack: number
  /** Seconds from the end of the attack to silence. */
  readonly decay: number
  readonly type: OscillatorType
  /** The low-pass this grain passes through, in Hz. */
  readonly toneHz: number
}

/** Grains in a rubble cloud. Sixteen, per `SOUNDSCAPE_DESIGN_2026-07.md`. */
export const RUBBLE_GRAINS = 16
/** Nothing in a collapse is brighter than this. */
export const RUBBLE_CEILING_HZ = 1400
/** Nothing pitched is brighter than this. */
export const TONE_CEILING_HZ = 2400

/**
 * Every oscillator a voice costs, and exactly what each one does.
 *
 * Pure. No allocation beyond the array it returns, and nothing here reads a
 * clock — `at` is relative to the voice, so a caller schedules the whole thing
 * off one `currentTime` read and a test reads it off nothing at all.
 */
export function voiceGrains(voice: PlayableVoice, scale = 1): readonly Grain[] {
  const hz = Math.max(1, voice.hz)
  const seconds = Math.max(0.01, voice.seconds)
  const peak = Math.max(0.0002, voice.gain * Math.max(0, scale))
  if (voice.timbre === "rubble") return rubbleGrains(hz, seconds, peak)

  // A fundamental plus a partial or two. The partial is what makes it a struck
  // object rather than a test tone, and the ratios are octaves rather than
  // inharmonic — inharmonic is the sound the founder is calling abrasive.
  const attack = safeAttack(voice.timbre === "bloom" ? 0.18 : voice.timbre === "pluck" ? 0.01 : 0.014)
  const partials: readonly { ratio: number; level: number; type: OscillatorType }[] =
    voice.timbre === "bloom"
      ? [
          { ratio: 1, level: 0.62, type: "sine" },
          { ratio: 2.001, level: 0.2, type: "sine" },
        ]
      : voice.timbre === "pluck"
        ? [
            { ratio: 1, level: 0.7, type: "triangle" },
            { ratio: 3, level: 0.12, type: "sine" },
          ]
        : [
            { ratio: 1, level: 0.68, type: "triangle" },
            { ratio: 2, level: 0.22, type: "sine" },
            { ratio: 4, level: 0.06, type: "sine" },
          ]
  const toneHz = Math.min(TONE_CEILING_HZ, hz * 6)
  return (
    partials
      // A partial ABOVE the ceiling is dropped, not merely filtered. The tone
      // filter is one pole: a bell's fourth partial on a 1.25 kHz voice sits at
      // 5 kHz and comes through it at about −12 dB, which is quieter than the
      // fundamental and still squarely inside the band that hurts. Dropping it
      // is what makes "nothing pitched is brighter than `TONE_CEILING_HZ`" a
      // statement about the oscillators rather than about an aspiration. The
      // fundamental is never dropped — a voice must make a sound.
      .filter((p, i) => i === 0 || hz * p.ratio <= TONE_CEILING_HZ)
      .map((p) => ({
        at: 0,
        hz: hz * p.ratio,
        glideTo: hz * p.ratio,
        glideSeconds: 0,
        peak: peak * p.level,
        attack,
        decay: Math.max(0.01, seconds - attack),
        type: p.type,
        toneHz,
      }))
  )
}

/**
 * A building coming down — the founder's "building crumbling here instead of
 * white noise".
 *
 * A noise burst is one event with no size to it, which is why it reads as hiss
 * rather than as a thing. Rubble is MANY small impacts whose sizes follow a
 * power law: grain `i` has size `1/(1+i)`, amplitude goes with size and pitch
 * goes inversely with it, so a few big low ones and a lot of small high ones.
 * **That distribution is the entire difference between "static" and
 * "masonry"**, and it costs sixteen short oscillators.
 *
 * The onsets are scattered by an integer hash rather than by `Math.random`, so
 * two collapses in the same session are the same shape — which is fine, because
 * the pitch comes from the walker and the walker is what varies — and a test
 * can assert the scatter.
 */
function rubbleGrains(hz: number, seconds: number, peak: number): readonly Grain[] {
  const out: Grain[] = []
  for (let i = 0; i < RUBBLE_GRAINS; i++) {
    const size = 1 / (1 + i)
    const at = (i / RUBBLE_GRAINS) * seconds * (0.5 + ((i * 7919) % 100) / 200)
    // Small stones are quiet and high, big ones are loud and low. Capped so the
    // brightest grain of the highest-pitched cloud still sits under 1.4 kHz.
    const top = Math.min(RUBBLE_CEILING_HZ, hz * (0.7 + 1 / Math.max(0.12, size) / 6))
    out.push({
      at,
      hz: top,
      glideTo: hz * 0.6,
      glideSeconds: 0.05,
      peak: Math.max(0.0002, peak * size * 0.9),
      attack: safeAttack(0.004),
      decay: 0.04 + size * 0.12,
      type: "triangle",
      toneHz: RUBBLE_CEILING_HZ,
    })
  }
  return out
}

/**
 * The loudest a voice can be at any single instant, as the sum of everything
 * sounding together.
 *
 * The honest measurement, and the reason it is not just `voice.gain`: a pitched
 * voice's partials all start at once, so its real peak is their SUM and is
 * larger than the gain the music module asked for. A rubble cloud's grains are
 * staggered and decay in tens of milliseconds, so its real peak is much smaller
 * than the sum of sixteen grains would suggest. Measuring one with the other's
 * rule is how a cue that looks quiet on paper arrives loud.
 */
export function voicePeak(voice: PlayableVoice, scale = 1): number {
  const grains = voiceGrains(voice, scale)
  let worst = 0
  for (const a of grains) {
    // Every grain's own onset is a candidate instant: an envelope is monotone
    // up then monotone down, so the maximum of a sum of them is at one of them.
    const t = a.at + a.attack
    let sum = 0
    for (const b of grains) {
      const start = b.at
      const top = b.at + b.attack
      const end = top + b.decay
      if (t <= start || t >= end) continue
      sum += t <= top ? (b.peak * (t - start)) / Math.max(1e-6, b.attack) : b.peak * (1 - (t - top) / Math.max(1e-6, b.decay))
    }
    if (sum > worst) worst = sum
  }
  return worst
}

/**
 * The brightest OSCILLATOR anything in this voice runs.
 *
 * Deliberately not `min(toneHz, …)`. A one-pole low-pass does not remove what
 * is above its corner, it attenuates it, so measuring a voice by its filter
 * rather than by its oscillators would report 2.4 kHz for a cue with real
 * energy at 5 — which is precisely the claim this is here to be able to make
 * honestly. The only exception is the fundamental, which is never dropped
 * because a voice has to make a sound; on the register `game-soundscape`
 * publishes (≤1250 Hz) it is always under the ceiling anyway.
 */
export function voiceBrightestHz(voice: PlayableVoice, scale = 1): number {
  let top = 0
  for (const g of voiceGrains(voice, scale)) top = Math.max(top, g.hz, g.glideTo)
  return top
}

/** The Web Audio a game needs for this, and nothing more. */
export type VoiceContext = {
  readonly currentTime: number
  createGain(): GainNode
  createOscillator(): OscillatorNode
  createBiquadFilter(): BiquadFilterNode
}

/**
 * Play one voice into `destination`.
 *
 * `destination` is the game's own master, which is already routed through
 * `createSafetyBus` — this never reaches for `ctx.destination`, and the source
 * scan in `routing.test.ts` is what keeps that true.
 *
 * `scale` is a `VoiceBudget` multiplier. 0 means "do not play this", and it is
 * honoured by building nothing at all rather than by building a silent graph.
 */
export function playVoice(
  ctx: VoiceContext,
  destination: AudioNode,
  voice: PlayableVoice,
  scale = 1,
): void {
  if (scale <= 0) return
  const t0 = ctx.currentTime + Math.max(0, voice.at)
  // One low-pass over the whole voice, so the top of the register is never the
  // brightest thing in the game.
  const tone = ctx.createBiquadFilter()
  tone.type = "lowpass"
  tone.Q.value = voice.timbre === "rubble" ? 0.6 : 0.7
  tone.connect(destination)
  let toneHz = TONE_CEILING_HZ
  for (const g of voiceGrains(voice, scale)) {
    toneHz = g.toneHz
    const at = t0 + g.at
    const osc = ctx.createOscillator()
    osc.type = g.type
    osc.frequency.setValueAtTime(g.hz, at)
    if (g.glideSeconds > 0 && g.glideTo !== g.hz) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, g.glideTo), at + g.glideSeconds)
    }
    const gain = ctx.createGain()
    const attack = Math.max(MIN_ATTACK, g.attack)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, g.peak), at + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + g.decay)
    osc.connect(gain)
    gain.connect(tone)
    osc.start(at)
    osc.stop(at + attack + g.decay + 0.06)
  }
  tone.frequency.value = toneHz
}
