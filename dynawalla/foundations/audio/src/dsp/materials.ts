/**
 * Modal materials — the sound of the bazaar, as physics.
 *
 * A struck object rings at a set of frequencies that are NOT harmonics. The
 * ratios below are what separate brass from tile from stone; getting them right
 * is the entire difference between "a real object was hit" and "a synthesiser
 * made a bleep". They are chosen from the standard analyses of each family:
 *
 *  - a circular membrane rings at the Bessel zeros (1, 1.593, 2.135, 2.295,
 *    2.917...) — that is a darbuka, and it is why a drum has a pitch you can
 *    almost but not quite name;
 *  - a free circular plate / gong is stretched-inharmonic and beats;
 *  - a bar free at both ends (a marimba bar, a tile shard) rings at 1, 2.756,
 *    5.404, 8.933 — the ratios of the transverse bar modes;
 *  - glass is a bar-like set with very long decay and almost no damping;
 *  - stone/wood is bar-like but so heavily damped the partials are gone before
 *    the ear resolves them, leaving only a thud with a colour.
 *
 * `t60` is the decay of the FUNDAMENTAL at the reference frequency; `decayExp`
 * makes higher modes die faster (all real objects damp high frequencies first —
 * omitting this is the single most common reason synthetic percussion sounds
 * like plastic).
 */

export interface Material {
  readonly id: string
  /** Frequency ratios of the modes. Index 0 should be 1. */
  readonly ratios: readonly number[]
  /** Relative amplitude of each mode. */
  readonly amps: readonly number[]
  /** Decay (s) of mode 0 at the nominal frequency. */
  readonly t60: number
  /** Higher modes decay as t60 * ratio^-decayExp. 0 = no HF damping. */
  readonly decayExp: number
  /** Excitation length, ms. Longer = softer mallet. */
  readonly strikeMs: number
  /** 0..1 excitation brightness. 1 = steel hammer, 0 = felt. */
  readonly hardness: number
  /** Cents of random detune applied per mode per strike (liveliness). */
  readonly detuneCents: number
  /** Extra pair-detuning that produces audible beating (gongs, big brass). */
  readonly beat?: number
}

export const MATERIALS = {
  /** Big struck brass — a tray, a lamp, a gong. Long, shimmering, beats. */
  brass: {
    id: "brass",
    ratios: [1, 2.01, 3.02, 4.17, 5.44, 6.81, 8.2, 9.75],
    amps: [1, 0.72, 0.58, 0.42, 0.34, 0.26, 0.19, 0.12],
    t60: 2.6,
    decayExp: 0.75,
    strikeMs: 1.4,
    hardness: 0.72,
    detuneCents: 12,
    beat: 3.2,
  },
  /** Small brass — a bead, a coin, a bell charm. Bright, short, sweet. */
  bell: {
    id: "bell",
    ratios: [1, 2.76, 5.4, 8.93, 11.34],
    amps: [1, 0.66, 0.42, 0.24, 0.14],
    t60: 1.1,
    decayExp: 1.1,
    strikeMs: 0.8,
    hardness: 0.86,
    detuneCents: 9,
    beat: 1.4,
  },
  /** Glazed tile — the confirm "chunk". Hard, ceramic, one clear pitch. */
  tile: {
    id: "tile",
    ratios: [1, 2.74, 5.36, 8.9],
    amps: [1, 0.5, 0.26, 0.12],
    t60: 0.34,
    decayExp: 1.5,
    strikeMs: 0.6,
    hardness: 0.9,
    detuneCents: 18,
  },
  /** Glass — long, pure, fragile. The sound of something precious. */
  glass: {
    id: "glass",
    ratios: [1, 2.71, 5.15, 8.94, 13.1],
    amps: [1, 0.55, 0.36, 0.2, 0.1],
    t60: 1.9,
    decayExp: 0.9,
    strikeMs: 0.5,
    hardness: 0.95,
    detuneCents: 6,
  },
  /** Stone / packed earth — the floor of the bazaar. Thud with a colour. */
  stone: {
    id: "stone",
    ratios: [1, 2.4, 4.1, 6.3],
    amps: [1, 0.42, 0.2, 0.09],
    t60: 0.11,
    decayExp: 1.9,
    strikeMs: 2.4,
    hardness: 0.32,
    detuneCents: 30,
  },
  /** Hardwood — a crate, a market stall, a counter. Warm, dry, woody. */
  wood: {
    id: "wood",
    ratios: [1, 3.02, 6.13, 9.94],
    amps: [1, 0.46, 0.22, 0.1],
    t60: 0.2,
    decayExp: 1.7,
    strikeMs: 1.4,
    hardness: 0.55,
    detuneCents: 24,
  },
  /** Stretched skin — a darbuka. The Bessel modes of a circular membrane. */
  skin: {
    id: "skin",
    ratios: [1, 1.593, 2.135, 2.295, 2.917, 3.5],
    amps: [1, 0.5, 0.34, 0.3, 0.18, 0.1],
    t60: 0.3,
    decayExp: 1.4,
    strikeMs: 1.8,
    hardness: 0.45,
    detuneCents: 20,
  },
  /** A tuned copper pot — comic, hollow, faintly ridiculous. Good for a miss. */
  pot: {
    id: "pot",
    ratios: [1, 1.5, 2.32, 3.11, 4.6, 5.92],
    amps: [1, 0.62, 0.44, 0.3, 0.18, 0.1],
    t60: 0.9,
    decayExp: 1.2,
    strikeMs: 1.1,
    hardness: 0.66,
    detuneCents: 16,
    beat: 2.6,
  },
} as const satisfies Record<string, Material>

export type MaterialId = keyof typeof MATERIALS

/**
 * Expand a material into the per-mode arrays the modal worklet wants.
 * `damp` 0..1 shortens everything (a hand on the bell). `bright` 0..1 tilts the
 * amplitude of the upper modes — this is what a soft vs hard strike does, and
 * it is the cheapest, most convincing intensity mapping there is.
 */
export interface ModeArrays {
  freqs: Float32Array
  amps: Float32Array
  t60s: Float32Array
}

export const expandMaterial = (
  m: Material,
  f0: number,
  opts: {
    damp?: number
    bright?: number
    rand?: () => number
    modes?: number
    /** Reuse these arrays instead of allocating. They are sliced to length. */
    into?: ModeArrays
  } = {},
): ModeArrays => {
  const rand = opts.rand ?? Math.random
  const damp = opts.damp ?? 0
  const bright = opts.bright ?? 0.5
  const n = Math.min(opts.modes ?? m.ratios.length, m.ratios.length)
  const freqs = opts.into ? opts.into.freqs.subarray(0, n) : new Float32Array(n)
  const amps = opts.into ? opts.into.amps.subarray(0, n) : new Float32Array(n)
  const t60s = opts.into ? opts.into.t60s.subarray(0, n) : new Float32Array(n)
  const beat = m.beat ?? 0
  for (let i = 0; i < n; i++) {
    const detune = (rand() * 2 - 1) * m.detuneCents + (i > 0 ? Math.sin(i * 2.4) * beat : 0)
    freqs[i] = f0 * m.ratios[i] * Math.pow(2, detune / 1200)
    // Tilt: bright=1 keeps upper modes, bright=0 rolls them off hard.
    const tilt = Math.pow(m.ratios[i], -(1.6 - bright * 1.5))
    amps[i] = m.amps[i] * tilt
    t60s[i] = m.t60 * Math.pow(m.ratios[i], -m.decayExp) * (1 - damp * 0.85)
  }
  // Renormalise so `bright` changes timbre, not loudness. A tone control that
  // also changes level is indistinguishable from a bug at playtest.
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, amps[i])
  if (peak > 0) for (let i = 0; i < n; i++) amps[i] /= peak
  return { freqs, amps, t60s }
}
