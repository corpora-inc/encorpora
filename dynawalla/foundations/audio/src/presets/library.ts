/**
 * The preset library — the thing a prototype author actually names.
 *
 * Every sound here is a composition of transient + body + tail (+ sub), tuned
 * by ear against the brief: a minaret-punk bazaar of brass, tile and glass.
 * Nothing is a sine beep; nothing is a stock "success chime".
 *
 * The pitch centre for the whole kit is **D** (293.66 Hz), and pitched presets
 * live on a **Hijaz**-flavoured set (1, b2, 3, 4, 5, b6, 7). That is a deliberate
 * choice: a major triad reads as a corporate onboarding flow, and Hijaz reads
 * as somewhere with hot dust and hammered metal. A child cannot name it and
 * will absolutely feel it.
 *
 * Loudness policy: presets are matched by measured short-term level, not by
 * "sounds about right". See `measure/loudness.ts` — every entry is within
 * ±2.5 LU of the kit reference, so a prototype never has one sound that makes
 * a parent lunge for the volume.
 */

import { MATERIALS } from "../dsp/materials.ts"
import { percEnv } from "../dsp/env.ts"
import { semi } from "../rng.ts"
import type { Preset, RenderCtx } from "../types.ts"
import { airTone, fmTone, grainCloud, noiseBurst, pan, route, subThump, sweep } from "./voices.ts"

/** D3. Everything pitched is relative to this. */
export const ROOT_HZ = 146.83

/** Hijaz on D: D Eb F# G A Bb C. In semitones from the root. */
export const HIJAZ = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19, 20, 22, 24]

/** A gentler set for failure/neutral sounds — no leading tone, no tension. */
export const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]

const hz = (semis: number): number => ROOT_HZ * semi(semis)

/** Strike the modal bank if it exists; fall back to FM so nothing is silent. */
const strike = (
  rc: RenderCtx,
  material: keyof typeof MATERIALS,
  freq: number,
  velocity: number,
  opts: { pan?: number; gain?: number; sustain?: number; damp?: number } = {},
): number => {
  const m = MATERIALS[material]
  const modes = Math.min(m.ratios.length, rc.tier === "low" ? 4 : rc.tier === "medium" ? 6 : 10)
  const bank = rc.modal
  if (bank) {
    bank.strike({
      when: rc.when,
      material: m,
      freq,
      velocity,
      modes,
      damp: opts.damp ?? 0,
      sustain: opts.sustain ?? 1,
      pan: opts.pan ?? 0,
      // The banks are shared per bus, so they cannot pass through the voice's
      // own gain node — the preset level is applied HERE instead.
      gain: (opts.gain ?? 1) * rc.level,
      rand: rc.rand,
    })
    return rc.when + m.t60 * (opts.sustain ?? 1) + 0.05
  }
  // Fallback: FM approximation of the material's two strongest modes.
  return fmTone(rc, {
    freq,
    ratio: m.ratios[1] ?? 2.7,
    index: 2 + velocity * 4,
    indexDecay: m.t60 * 0.25,
    gain: (opts.gain ?? 1) * 0.5 * velocity,
    decay: m.t60 * (opts.sustain ?? 1),
    pan: opts.pan ?? 0,
    send: 0.3,
  })
}

const p = (def: Preset): Preset => def

// ---------------------------------------------------------------------------
// UI — heard hundreds of times a session. These must be SHORT, quiet, and
// varied, or they become the sound of a dripping tap.
// ---------------------------------------------------------------------------

export const UI_PRESETS: Preset[] = [
  p({
    id: "ui.tap",
    bus: "ui",
    gain: 1.23,
    group: "ui",
    poly: 4,
    haptic: "light",
    weight: 0.15,
    minGap: 0.03,
    jitterCents: 55,
    render(rc) {
      // Transient only: velvet noise through a high bandpass. A fingertip on
      // glazed tile. 12 ms long, and the ear still reads it as "a thing".
      const f = 2400 * semi(rc.semitones)
      const a = noiseBurst(rc, {
        kind: "velvet",
        freq: f * rc.range(0.92, 1.09),
        q: 2.4,
        gain: 0.5 * (0.5 + rc.intensity * 0.5),
        decay: 0.016,
        highpass: 900,
        pan: rc.range(-0.12, 0.12),
        send: 0.05,
      })
      // A whisper of tile body underneath gives the tap a material.
      const b = strike(rc, "tile", hz(24 + rc.semitones), 0.22 + rc.intensity * 0.2, {
        gain: 0.22,
        sustain: 0.5,
      })
      return { endsAt: Math.max(a, b) }
    },
  }),

  p({
    id: "ui.chunk",
    bus: "ui",
    gain: 0.131,
    group: "ui",
    poly: 3,
    haptic: "medium",
    weight: 0.4,
    duck: 0.12,
    minGap: 0.04,
    jitterCents: 25,
    render(rc) {
      // The confirmation. Wood transient + tile body + a short sub. This is the
      // "a heavy well-made thing seated into its slot" sound, and it is the one
      // preset most worth stealing for any other project.
      const t = noiseBurst(rc, {
        kind: "white",
        freq: 1500 * rc.range(0.9, 1.12),
        q: 0.9,
        gain: 0.34,
        decay: 0.022,
        highpass: 400,
        send: 0.08,
      })
      const body = strike(rc, "wood", hz(12 + rc.semitones), 0.55 + rc.intensity * 0.4, {
        gain: 0.95,
        pan: rc.range(-0.08, 0.08),
      })
      const s = subThump(rc, { freq: 82, drop: 5, fall: 0.045, gain: 0.32 * rc.intensity, decay: 0.1, drive: 0.4 })
      return { endsAt: Math.max(t, body, s) }
    },
  }),

  p({
    id: "ui.select",
    bus: "ui",
    gain: 0.209,
    group: "ui",
    poly: 3,
    haptic: "light",
    weight: 0.2,
    jitterCents: 20,
    render(rc) {
      // A single struck bead, pitched up the Hijaz scale — used for stepping
      // through options, so it must feel like movement, not like a click.
      const step = HIJAZ[Math.min(HIJAZ.length - 1, Math.round(rc.intensity * 6))]
      const a = strike(rc, "bell", hz(24 + step + rc.semitones), 0.45, { gain: 0.5, sustain: 0.5 })
      const b = noiseBurst(rc, { kind: "velvet", freq: 5200, q: 3, gain: 0.16, decay: 0.01, highpass: 2000 })
      return { endsAt: Math.max(a, b) }
    },
  }),

  p({
    id: "ui.back",
    bus: "ui",
    gain: 0.386,
    group: "ui",
    poly: 2,
    haptic: "light",
    weight: 0.2,
    jitterCents: 20,
    render(rc) {
      const a = strike(rc, "wood", hz(7 + rc.semitones), 0.4, { gain: 0.6, sustain: 0.7 })
      const b = noiseBurst(rc, {
        kind: "pink",
        freq: 1800,
        freqTo: 500,
        sweep: 0.09,
        q: 1.6,
        gain: 0.18,
        decay: 0.1,
        send: 0.1,
      })
      return { endsAt: Math.max(a, b) }
    },
  }),

  p({
    id: "ui.toggle",
    bus: "ui",
    gain: 0.472,
    group: "ui",
    poly: 2,
    haptic: "light",
    weight: 0.25,
    render(rc) {
      // Two-part latch: a tiny stone click and a metal catch 28 ms later.
      const a = strike(rc, "stone", hz(19 + rc.semitones), 0.5, { gain: 0.5 })
      const rc2 = { ...rc, when: rc.when + 0.028 } as RenderCtx
      const b = strike(rc2, "bell", hz(31 + rc.semitones), 0.35, { gain: 0.3, sustain: 0.35 })
      return { endsAt: Math.max(a, b) }
    },
  }),
]

// ---------------------------------------------------------------------------
// IMPACTS — the physical vocabulary of the bazaar.
// ---------------------------------------------------------------------------

export const IMPACT_PRESETS: Preset[] = [
  p({
    id: "impact.brass",
    bus: "sfx",
    gain: 0.09,
    group: "impact",
    poly: 4,
    haptic: "heavy",
    weight: 0.9,
    duck: 0.3,
    jitterCents: 18,
    render(rc) {
      const t = noiseBurst(rc, {
        kind: "white",
        freq: 3800 * rc.range(0.85, 1.15),
        q: 0.7,
        gain: 0.4 * rc.intensity,
        decay: 0.03,
        highpass: 1200,
        send: 0.2,
      })
      const body = strike(rc, "brass", hz(rc.semitones), 0.5 + rc.intensity * 0.5, {
        gain: 1,
        pan: rc.range(-0.2, 0.2),
      })
      const s = subThump(rc, { freq: 58, drop: 7, gain: 0.4 * rc.intensity, decay: 0.22, drive: 0.5 })
      const air = airTone(rc, hz(24 + rc.semitones), 0.06 * rc.intensity, 1.2)
      return { endsAt: Math.max(t, body, s, air) }
    },
  }),

  p({
    id: "impact.tile",
    bus: "sfx",
    gain: 0.395,
    group: "impact",
    poly: 6,
    haptic: "medium",
    weight: 0.5,
    jitterCents: 40,
    render(rc) {
      const t = noiseBurst(rc, {
        kind: "velvet",
        freq: 3000 * rc.range(0.85, 1.2),
        q: 1.4,
        gain: 0.3 * (0.4 + rc.intensity * 0.6),
        decay: 0.018,
        highpass: 900,
        send: 0.12,
      })
      const body = strike(rc, "tile", hz(12 + rc.semitones), 0.4 + rc.intensity * 0.6, {
        gain: 0.9,
        pan: rc.range(-0.3, 0.3),
      })
      return { endsAt: Math.max(t, body) }
    },
  }),

  p({
    id: "impact.stone",
    bus: "sfx",
    gain: 0.489,
    group: "impact",
    poly: 5,
    haptic: "heavy",
    weight: 0.6,
    jitterCents: 45,
    render(rc) {
      const t = noiseBurst(rc, {
        kind: "brown",
        freq: 700 * rc.range(0.8, 1.25),
        q: 0.6,
        gain: 0.45 * rc.intensity,
        decay: 0.045,
        send: 0.1,
      })
      const body = strike(rc, "stone", hz(-5 + rc.semitones), 0.5 + rc.intensity * 0.5, { gain: 1 })
      const s = subThump(rc, { freq: 48, drop: 9, gain: 0.5 * rc.intensity, decay: 0.14, drive: 0.55 })
      return { endsAt: Math.max(t, body, s) }
    },
  }),

  p({
    id: "impact.glass",
    bus: "sfx",
    gain: 0.272,
    group: "impact",
    poly: 5,
    haptic: "light",
    weight: 0.55,
    jitterCents: 30,
    render(rc) {
      const t = noiseBurst(rc, {
        kind: "velvet",
        freq: 7000,
        q: 2.2,
        gain: 0.24 * rc.intensity,
        decay: 0.012,
        highpass: 3000,
        send: 0.25,
      })
      const body = strike(rc, "glass", hz(19 + rc.semitones), 0.4 + rc.intensity * 0.5, {
        gain: 0.7,
        pan: rc.range(-0.35, 0.35),
      })
      return { endsAt: Math.max(t, body) }
    },
  }),

  p({
    id: "impact.drum",
    bus: "sfx",
    gain: 0.285,
    group: "impact",
    poly: 4,
    haptic: "heavy",
    weight: 0.7,
    duck: 0.18,
    jitterCents: 35,
    render(rc) {
      // Darbuka. The membrane modes do the work; the noise is just the palm.
      const t = noiseBurst(rc, {
        kind: "pink",
        freq: 2200,
        q: 0.8,
        gain: 0.22 * rc.intensity,
        decay: 0.02,
        highpass: 700,
      })
      const body = strike(rc, "skin", hz(-5 + rc.semitones), 0.5 + rc.intensity * 0.5, { gain: 1 })
      const s = subThump(rc, { freq: 62, drop: 6, gain: 0.35 * rc.intensity, decay: 0.12, drive: 0.35 })
      return { endsAt: Math.max(t, body, s) }
    },
  }),

  p({
    id: "impact.pot",
    bus: "sfx",
    gain: 0.26,
    group: "impact",
    poly: 3,
    haptic: "medium",
    weight: 0.5,
    jitterCents: 40,
    render(rc) {
      const t = noiseBurst(rc, { kind: "white", freq: 2600, q: 1, gain: 0.26 * rc.intensity, decay: 0.025, highpass: 800 })
      const body = strike(rc, "pot", hz(3 + rc.semitones), 0.45 + rc.intensity * 0.5, { gain: 0.9 })
      return { endsAt: Math.max(t, body) }
    },
  }),
]

// ---------------------------------------------------------------------------
// PLUCKS — Karplus-Strong. The santur/oud voice of the place.
// ---------------------------------------------------------------------------

export const PLUCK_PRESETS: Preset[] = [
  p({
    id: "pluck.string",
    bus: "sfx",
    gain: 2.48,
    group: "pluck",
    poly: 8,
    haptic: "light",
    weight: 0.45,
    jitterCents: 12,
    render(rc) {
      const f = hz(12 + rc.semitones)
      if (rc.strings) {
        rc.strings.pluck({
          when: rc.when,
          freq: f,
          velocity: 0.35 + rc.intensity * 0.6,
          decay: 1.1 + rc.rand() * 0.5,
          damping: 0.28 - rc.intensity * 0.12,
          position: 0.14 + rc.rand() * 0.16,
          pan: rc.range(-0.3, 0.3),
          gain: 0.75 * rc.level,
        })
        // The pick noise is NOT part of the string model and its absence is
        // exactly why pure Karplus-Strong sounds like a 1983 demo.
        const t = noiseBurst(rc, {
          kind: "velvet",
          freq: 4200,
          q: 1.8,
          gain: 0.12 * rc.intensity,
          decay: 0.01,
          highpass: 2200,
          send: 0.15,
        })
        return { endsAt: Math.max(rc.when + 1.7, t) }
      }
      return { endsAt: fmTone(rc, { freq: f, ratio: 1, index: 3, indexDecay: 0.05, gain: 0.4, decay: 0.9, send: 0.2 }) }
    },
  }),

  p({
    id: "pluck.harp",
    bus: "sfx",
    gain: 3.782,
    group: "pluck",
    poly: 10,
    haptic: "light",
    weight: 0.35,
    minGap: 0.02,
    jitterCents: 8,
    render(rc) {
      // A rolled chord across the Hijaz scale — one call, four strings, 26 ms
      // apart. Rolling rather than blocking is what makes it feel played.
      const base = 12 + rc.semitones
      let end = rc.when
      for (let i = 0; i < 4; i++) {
        const step = HIJAZ[i * 2] ?? 0
        const at = rc.when + i * (0.022 + rc.rand() * 0.012)
        if (rc.strings) {
          rc.strings.pluck({
            when: at,
            freq: hz(base + step + 12),
            velocity: 0.5 - i * 0.06,
            decay: 1.4,
            damping: 0.2,
            position: 0.2,
            pan: -0.3 + i * 0.2,
            gain: 0.5 * rc.level,
          })
        }
        end = at + 1.6
      }
      return { endsAt: end }
    },
  }),
]

// ---------------------------------------------------------------------------
// REWARD — the reason a child comes back. Layered, escalating, generous.
// ---------------------------------------------------------------------------

export const REWARD_PRESETS: Preset[] = [
  p({
    id: "reward.bead",
    bus: "sfx",
    gain: 1.309,
    group: "reward",
    poly: 8,
    haptic: "light",
    weight: 0.4,
    minGap: 0.035,
    jitterCents: 22,
    render(rc) {
      // A small brass bead landing in a bowl. Two detuned FM bells + a tick.
      const f = 900 * semi(rc.semitones)
      const a = fmTone(rc, {
        freq: f,
        ratio: 3.51,
        index: 2.2 + rc.intensity * 1.6,
        indexDecay: 0.045,
        gain: 0.34,
        decay: 0.34,
        spread: 9,
        pan: rc.range(-0.25, 0.25),
        send: 0.25,
      })
      const b = noiseBurst(rc, { kind: "velvet", freq: 6200, q: 3, gain: 0.13, decay: 0.008, highpass: 2800 })
      return { endsAt: Math.max(a, b) }
    },
  }),

  p({
    id: "reward.chime",
    bus: "sfx",
    gain: 0.165,
    group: "reward",
    poly: 6,
    haptic: "success",
    weight: 0.6,
    duck: 0.22,
    jitterCents: 10,
    render(rc) {
      const a = strike(rc, "bell", hz(24 + rc.semitones), 0.6 + rc.intensity * 0.4, { gain: 0.8, pan: -0.15 })
      const rc2 = { ...rc, when: rc.when + 0.075 } as RenderCtx
      const b = strike(rc2, "bell", hz(31 + rc.semitones), 0.5 + rc.intensity * 0.4, { gain: 0.65, pan: 0.18 })
      const air = airTone(rc, hz(36 + rc.semitones), 0.05, 1.1)
      return { endsAt: Math.max(a, b, air) }
    },
  }),

  p({
    id: "reward.big",
    bus: "sfx",
    gain: 0.126,
    group: "reward",
    poly: 2,
    haptic: "success",
    weight: 1,
    duck: 0.55,
    minGap: 0.4,
    jitterCents: 6,
    render(rc) {
      // The big one. Sub + brass gong + rolled harp + a shimmer cloud, ducked
      // hard so the music gets out of its way. This is the moment the whole
      // kit exists to make land.
      const s = subThump(rc, { freq: 44, drop: 10, fall: 0.09, gain: 0.6, decay: 0.5, drive: 0.6 })
      const g = strike(rc, "brass", hz(rc.semitones), 0.95, { gain: 1, sustain: 1.25 })
      const g2 = strike({ ...rc, when: rc.when + 0.012 } as RenderCtx, "brass", hz(7 + rc.semitones), 0.7, {
        gain: 0.6,
        pan: 0.25,
        sustain: 1.1,
      })
      let end = Math.max(s, g, g2)
      if (rc.strings) {
        for (let i = 0; i < 6; i++) {
          const at = rc.when + 0.06 + i * 0.035
          rc.strings.pluck({
            when: at,
            freq: hz(24 + (HIJAZ[i] ?? 0)),
            velocity: 0.7 - i * 0.05,
            decay: 1.6,
            damping: 0.18,
            position: 0.18,
            pan: -0.4 + i * 0.16,
            gain: 0.5 * rc.level,
          })
          end = Math.max(end, at + 1.8)
        }
      }
      const rate = Math.min(rc.tier === "low" ? 0 : rc.tier === "medium" ? 45 : 110, 110)
      if (rate > 0) {
        end = Math.max(end, grainCloud(rc, { rate, seconds: 0.9, freq: 4200, spreadSemis: 14, gain: 0.32, send: 0.5, fadeIn: 0.15 }))
      }
      const sw = sweep(rc, { from: 380, to: 5200, time: 0.55, q: 2.2, gain: 0.16, swell: 0.6, send: 0.4 })
      return { endsAt: Math.max(end, sw) }
    },
  }),

  p({
    id: "reward.unlock",
    bus: "sfx",
    gain: 0.581,
    group: "reward",
    poly: 2,
    haptic: "success",
    weight: 0.85,
    duck: 0.4,
    jitterCents: 8,
    render(rc) {
      // A latch releasing, then light. Mechanism first, then reward — the order
      // matters; reversed, it reads as a mistake being corrected.
      const a = strike(rc, "stone", hz(7 + rc.semitones), 0.6, { gain: 0.7 })
      const b = strike({ ...rc, when: rc.when + 0.04 } as RenderCtx, "bell", hz(19 + rc.semitones), 0.55, { gain: 0.6 })
      const c = strike({ ...rc, when: rc.when + 0.12 } as RenderCtx, "glass", hz(31 + rc.semitones), 0.6, {
        gain: 0.55,
        sustain: 1.3,
      })
      const sw = sweep(rc, { from: 600, to: 4800, time: 0.4, q: 3, gain: 0.13, swell: 0.5, send: 0.45 })
      return { endsAt: Math.max(a, b, c, sw) }
    },
  }),
]

// ---------------------------------------------------------------------------
// COMBO — the rising ladder. Called with a streak index; the kit owns the
// musicality so no prototype has to.
// ---------------------------------------------------------------------------

export const COMBO_PRESET: Preset = p({
  id: "combo",
  bus: "sfx",
  gain: 0.431,
  group: "combo",
  poly: 4,
  haptic: "medium",
  weight: 0.55,
  minGap: 0.05,
  jitterCents: 6,
  render(rc) {
    // `semitones` already carries the ladder step (see `combo()` in index.ts).
    const f = hz(24 + rc.semitones)
    const bright = Math.min(1, 0.35 + rc.intensity * 0.75)
    const a = fmTone(rc, {
      freq: f,
      ratio: 2.01,
      index: 1.6 + bright * 3.4,
      indexDecay: 0.06,
      gain: 0.36,
      decay: 0.42,
      spread: 7,
      pan: rc.range(-0.2, 0.2),
      send: 0.3,
    })
    const b = strike(rc, "bell", f, 0.35 + bright * 0.5, { gain: 0.45, sustain: 0.8 })
    const t = noiseBurst(rc, { kind: "velvet", freq: 5600, q: 2.6, gain: 0.1 + bright * 0.08, decay: 0.009, highpass: 2600 })
    // Above 8 in a row, the ladder starts adding a low octave — the streak
    // acquires WEIGHT as well as height, which is what stops it sounding shrill.
    let s = rc.when
    if (rc.intensity > 0.55) {
      s = subThump(rc, { freq: 70, drop: 4, gain: 0.18 * rc.intensity, decay: 0.14, drive: 0.4 })
    }
    return { endsAt: Math.max(a, b, t, s) }
  },
})

// ---------------------------------------------------------------------------
// FAILURE — interesting, never punishing. ADR-0009 forbids loss; the audio
// must agree. No buzzer, no descending minor third, no "wah wah".
// ---------------------------------------------------------------------------

export const FAIL_PRESETS: Preset[] = [
  p({
    id: "fail.soft",
    bus: "sfx",
    gain: 0.792,
    group: "fail",
    poly: 2,
    haptic: "warning",
    weight: 0.4,
    duck: 0.15,
    jitterCents: 20,
    render(rc) {
      // A wooden bead dropped on cloth. Dull, close, faintly comic — the sound
      // of "not that one", not the sound of "you are bad".
      const t = noiseBurst(rc, { kind: "brown", freq: 420, q: 0.8, gain: 0.3, decay: 0.06, send: 0.06 })
      const a = strike(rc, "wood", hz(-2 + rc.semitones), 0.4, { gain: 0.7, damp: 0.35 })
      const b = strike({ ...rc, when: rc.when + 0.085 } as RenderCtx, "wood", hz(-5 + rc.semitones), 0.25, {
        gain: 0.4,
        damp: 0.5,
      })
      return { endsAt: Math.max(t, a, b) }
    },
  }),

  p({
    id: "fail.pot",
    bus: "sfx",
    gain: 0.507,
    group: "fail",
    poly: 2,
    haptic: "warning",
    weight: 0.5,
    duck: 0.2,
    jitterCents: 25,
    render(rc) {
      // A copper pot wobbling on a counter. Genuinely funny, and the wobble
      // (three strikes at shrinking intervals) is why.
      let end = rc.when
      const times = [0, 0.11, 0.185, 0.235, 0.27]
      for (let i = 0; i < times.length; i++) {
        const e = strike({ ...rc, when: rc.when + times[i] } as RenderCtx, "pot", hz(3 + rc.semitones), 0.45 - i * 0.08, {
          gain: 0.7 - i * 0.12,
          pan: (i % 2 === 0 ? -1 : 1) * 0.12,
          sustain: 0.6,
        })
        end = Math.max(end, e)
      }
      return { endsAt: end }
    },
  }),

  p({
    id: "fail.retry",
    bus: "sfx",
    gain: 2.948,
    group: "fail",
    poly: 2,
    haptic: "light",
    weight: 0.35,
    jitterCents: 15,
    render(rc) {
      // Two notes DOWN then one back UP, resolving to the fifth. It ends open
      // and consonant, which is the audio equivalent of "go on, again".
      const steps = [7, 3, 5]
      let end = rc.when
      for (let i = 0; i < steps.length; i++) {
        const at = rc.when + i * 0.09
        const e = fmTone({ ...rc, when: at } as RenderCtx, {
          freq: hz(12 + steps[i] + rc.semitones),
          ratio: 1.0,
          index: 1.1,
          indexDecay: 0.05,
          gain: 0.26,
          decay: 0.24,
          pan: -0.15 + i * 0.15,
          send: 0.25,
        })
        end = Math.max(end, e)
      }
      return { endsAt: end }
    },
  }),

  p({
    id: "fail.lampOut",
    bus: "sfx",
    gain: 0.496,
    group: "fail",
    poly: 1,
    haptic: "warning",
    weight: 0.8,
    duck: 0.35,
    minGap: 0.5,
    jitterCents: 10,
    render(rc) {
      // The lamp burning out — the business model's emotional beat. A glass
      // ring being damped away, a falling filtered sweep, one soft thud. It has
      // to feel like a LOSS OF WARMTH, never like a penalty klaxon.
      const g = strike(rc, "glass", hz(19 + rc.semitones), 0.5, { gain: 0.55, sustain: 0.45, damp: 0.25 })
      const sw = sweep(rc, { from: 2600, to: 240, time: 0.7, q: 2.4, gain: 0.2, kind: "pink", send: 0.4 })
      const th = subThump(rc, { freq: 52, drop: 4, fall: 0.12, gain: 0.28, decay: 0.35, drive: 0.3 })
      const last = strike({ ...rc, when: rc.when + 0.62 } as RenderCtx, "wood", hz(-7 + rc.semitones), 0.3, {
        gain: 0.5,
        damp: 0.4,
      })
      return { endsAt: Math.max(g, sw, th, last) }
    },
  }),
]

// ---------------------------------------------------------------------------
// MOTION — transitions. Cheap, and they carry an enormous amount of polish.
// ---------------------------------------------------------------------------

export const MOTION_PRESETS: Preset[] = [
  p({
    id: "motion.whoosh",
    bus: "sfx",
    gain: 2.1,
    group: "motion",
    poly: 3,
    haptic: "none",
    weight: 0.3,
    jitterCents: 60,
    render(rc) {
      const dir = rc.rand() < 0.5 ? 1 : -1
      const a = sweep(rc, {
        from: dir > 0 ? 420 : 3600,
        to: dir > 0 ? 3600 : 420,
        time: 0.26 + rc.rand() * 0.1,
        q: 1.6,
        gain: 0.75 * (0.5 + rc.intensity * 0.5),
        kind: "pink",
        pan: -dir * 0.4,
        send: 0.3,
      })
      return { endsAt: a }
    },
  }),

  p({
    id: "motion.arrive",
    bus: "sfx",
    gain: 0.269,
    group: "motion",
    poly: 2,
    haptic: "medium",
    weight: 0.45,
    duck: 0.18,
    render(rc) {
      const sw = sweep(rc, { from: 300, to: 2600, time: 0.34, q: 2, gain: 0.2, swell: 0.8, send: 0.35 })
      const hit = strike({ ...rc, when: rc.when + 0.3 } as RenderCtx, "tile", hz(12 + rc.semitones), 0.6, { gain: 0.8 })
      const s = subThump({ ...rc, when: rc.when + 0.3 } as RenderCtx, {
        freq: 60,
        drop: 6,
        gain: 0.3,
        decay: 0.18,
        drive: 0.4,
      })
      return { endsAt: Math.max(sw, hit, s) }
    },
  }),

  p({
    id: "motion.pop",
    bus: "ui",
    gain: 4.098,
    group: "motion",
    poly: 5,
    haptic: "light",
    weight: 0.25,
    jitterCents: 70,
    render(rc) {
      // Pitch-dropping sine + a tick. The classic "bubble", but tuned to the
      // scale so a run of them is a melody rather than a sequence of farts.
      const ctx = rc.ctx
      const osc = ctx.createOscillator()
      osc.type = "sine"
      const f = hz(24 + rc.semitones)
      osc.frequency.setValueAtTime(f * 2.2, rc.when)
      osc.frequency.exponentialRampToValueAtTime(f, rc.when + 0.055)
      const g = ctx.createGain()
      const end = percEnv(g.gain, rc.when, 0.3 * (0.5 + rc.intensity * 0.5), 0.003, 0.09)
      osc.connect(g)
      const pp = pan(rc, rc.range(-0.3, 0.3))
      if (pp) {
        g.connect(pp)
        route(rc, pp, 0.15)
      } else route(rc, g, 0.15)
      osc.start(rc.when)
      osc.stop(end + 0.02)
      const t = noiseBurst(rc, { kind: "velvet", freq: 4800, q: 2, gain: 0.09, decay: 0.007, highpass: 2400 })
      return { endsAt: Math.max(end, t) }
    },
  }),
]

export const ALL_PRESETS: Preset[] = [
  ...UI_PRESETS,
  ...IMPACT_PRESETS,
  ...PLUCK_PRESETS,
  ...REWARD_PRESETS,
  ...FAIL_PRESETS,
  ...MOTION_PRESETS,
  COMBO_PRESET,
]

export type PresetId =
  | "ui.tap"
  | "ui.chunk"
  | "ui.select"
  | "ui.back"
  | "ui.toggle"
  | "impact.brass"
  | "impact.tile"
  | "impact.stone"
  | "impact.glass"
  | "impact.drum"
  | "impact.pot"
  | "pluck.string"
  | "pluck.harp"
  | "reward.bead"
  | "reward.chime"
  | "reward.big"
  | "reward.unlock"
  | "fail.soft"
  | "fail.pot"
  | "fail.retry"
  | "fail.lampOut"
  | "motion.whoosh"
  | "motion.arrive"
  | "motion.pop"
  | "combo"
