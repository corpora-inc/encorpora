/**
 * beatlounge — the PARAMETRIC voice builder.
 *
 * Turns ONE `VoiceParams` (plain data from a KitDef) into a live, triggerable
 * Tone voice connected to an output node. This is the single place that touches
 * Tone for the drum kit — the corpus + resolve layer stay pure & testable, and
 * the synth (instruments/drumKit.ts) just assembles 16 of these per kit.
 *
 * A voice is built from one of three engines (see VoiceParams.source):
 *   • membrane — Tone.MembraneSynth, triggered at `baseNote`.
 *   • noise    — Tone.NoiseSynth through filter2→filter, plus an optional
 *                membrane `body` layer (snare body).
 *   • tonal    — one or two Tone.Oscillators through an optional band-pass,
 *                gated by an AmplitudeEnvelope (cowbell / clave / rim).
 *
 * Each built voice exposes `trigger(when, velocity)` and `dispose()`. The synth
 * holds onto these and calls `dispose()` when the kit swaps (no node leaks).
 */

import * as Tone from "tone"
import type {
  BodyLayer,
  Envelope,
  VoiceFilter,
  VoiceParams,
} from "./types"

/** A live voice the synth triggers + disposes. */
export interface BuiltVoice {
  /** Schedule a hit at an exact AudioContext time. */
  trigger(when: number, velocity: number): void
  /** Free every Tone node this voice owns. */
  dispose(): void
}

const midiToNote = (m: number): string => Tone.Frequency(m, "midi").toNote()

/** Tone envelopes want every field present; default sustain/release to 0. */
const env = (e: Envelope): Tone.EnvelopeOptions =>
  ({
    attack: e.attack,
    decay: e.decay,
    sustain: e.sustain ?? 0,
    release: e.release ?? 0.01,
  }) as Tone.EnvelopeOptions

/** Build (filter2 → filter) in series in front of `out`; returns the head node
 *  a source connects INTO. If neither filter is set, returns `out` directly. */
const buildFilterChain = (
  out: Tone.ToneAudioNode,
  filter: VoiceFilter | undefined,
  filter2: VoiceFilter | undefined,
  owned: Tone.ToneAudioNode[]
): Tone.ToneAudioNode => {
  let head = out
  const makeFilter = (f: VoiceFilter): Tone.Filter => {
    const node = new Tone.Filter({ type: f.type, frequency: f.frequency, Q: f.q ?? 1 })
    owned.push(node)
    return node
  }
  // Connected order should be: source → filter2 → filter → out.
  // We build from the tail (out) backwards.
  if (filter) {
    const fNode = makeFilter(filter).connect(head)
    head = fNode
  }
  if (filter2) {
    const f2 = makeFilter(filter2).connect(head)
    head = f2
  }
  return head
}

/** A membrane "body" layer (snare thump), retriggered alongside a noise voice. */
const buildBody = (
  out: Tone.ToneAudioNode,
  body: BodyLayer,
  owned: Tone.ToneAudioNode[]
): ((when: number, velocity: number) => void) => {
  const synth = new Tone.MembraneSynth({
    pitchDecay: body.pitchDecay,
    octaves: body.octaves,
    oscillator: { type: body.type },
    envelope: env(body.env),
    volume: body.level ?? 0,
  }).connect(out)
  owned.push(synth)
  const noteStr = midiToNote(body.baseNote)
  return (when, velocity) => synth.triggerAttackRelease(noteStr, "16n", when, velocity)
}

/**
 * Build one voice from its params. `out` is the kit's master Gain. Returns a
 * BuiltVoice that triggers + disposes everything it created.
 */
export const buildVoice = (params: VoiceParams, out: Tone.Gain): BuiltVoice => {
  const owned: Tone.ToneAudioNode[] = []
  const level = params.level ?? 0

  switch (params.source) {
    // ----------------------------------------------------------- MEMBRANE
    case "membrane": {
      const synth = new Tone.MembraneSynth({
        pitchDecay: params.pitchDecay ?? 0.03,
        octaves: params.octaves ?? 4,
        oscillator: { type: params.osc ?? "sine" },
        envelope: env(params.env),
        volume: level,
      })
      owned.push(synth)
      const head = buildFilterChain(out, params.filter, params.filter2, owned)
      synth.connect(head)
      const noteStr = midiToNote(params.baseNote ?? 36)
      const dur = params.durationSec ?? 0.25
      return {
        trigger: (when, velocity) =>
          synth.triggerAttackRelease(noteStr, dur, when, velocity),
        dispose: () => owned.forEach((n) => n.dispose()),
      }
    }

    // -------------------------------------------------------------- NOISE
    case "noise": {
      const synth = new Tone.NoiseSynth({
        noise: { type: params.noise ?? "white" },
        envelope: env(params.env),
        volume: level,
      })
      owned.push(synth)
      const head = buildFilterChain(out, params.filter, params.filter2, owned)
      synth.connect(head)
      const triggerBody = params.body ? buildBody(out, params.body, owned) : undefined
      const dur = params.durationSec
      return {
        trigger: (when, velocity) => {
          if (dur != null) synth.triggerAttackRelease(dur, when, velocity)
          else synth.triggerAttack(when, velocity)
          triggerBody?.(when, velocity * 0.7)
        },
        dispose: () => owned.forEach((n) => n.dispose()),
      }
    }

    // -------------------------------------------------------------- TONAL
    case "tonal": {
      // Amp-gated oscillator(s) through an optional band-pass. The classic
      // cowbell/clave path. The first partial is baseNote+osc unless explicit
      // `partials` are given (cowbell authors absolute-frequency squares).
      const ampEnv = new Tone.AmplitudeEnvelope(env(params.env))
      owned.push(ampEnv)
      const head = buildFilterChain(out, params.filter, params.filter2, owned)
      ampEnv.connect(head)

      const oscs: Tone.Oscillator[] = []
      const partials = params.partials
      if (partials && partials.length > 0) {
        for (const p of partials) {
          const osc = new Tone.Oscillator({
            frequency: p.frequency,
            type: p.type,
            volume: p.level ?? 0,
          }).connect(ampEnv)
          osc.start()
          oscs.push(osc)
        }
      } else {
        const osc = new Tone.Oscillator({
          frequency: Tone.Frequency(params.baseNote ?? 60, "midi").toFrequency(),
          type: params.osc ?? "triangle",
          volume: level,
        }).connect(ampEnv)
        osc.start()
        oscs.push(osc)
      }
      owned.push(...oscs)
      const dur = params.durationSec ?? params.env.decay + (params.env.release ?? 0)
      return {
        trigger: (when, velocity) => ampEnv.triggerAttackRelease(dur, when, velocity),
        dispose: () => owned.forEach((n) => n.dispose()),
      }
    }
  }
}
