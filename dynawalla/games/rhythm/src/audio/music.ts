/**
 * Procedural arrangement.
 *
 * The player is the drummer. The kick, snare and bell you hear on a hit are
 * *your* hits — miss and there is a hole in the groove. Everything in this file
 * is the band behind you: bass, pad, arpeggio, counter-melody, and a quiet
 * pulse so there is always a clock to lock onto even in a bar with no notes.
 *
 * Layers unlock with combo, so escalation is something you HEAR before you read
 * it off a number.
 */

import type { AudioEngine } from "./engine.ts";

export type Quality = "min" | "maj";
export type Chord = { off: number; q: Quality };

export type Sector = {
  id: string;
  /** shown once, briefly, when the sector turns over */
  name: string;
  /** midi note of the tonic, bass register */
  root: number;
  prog: readonly Chord[];
  /** 0 = straight, 0.2 ≈ light swing on offbeat eighths */
  swing: number;
  bpmBias: number;
};

/** Natural-minor harmony, so every progression is consonant with the same
 *  pentatonic lead pool and sectors can cross-fade without a key clash. */
export const SECTORS: readonly Sector[] = [
  {
    id: "indigo",
    name: "INDIGO",
    root: 45, // A2
    prog: [
      { off: 0, q: "min" },
      { off: 8, q: "maj" },
      { off: 3, q: "maj" },
      { off: 10, q: "maj" },
    ],
    swing: 0,
    bpmBias: 0,
  },
  {
    id: "ember",
    name: "EMBER",
    root: 43, // G2
    prog: [
      { off: 0, q: "min" },
      { off: 10, q: "maj" },
      { off: 8, q: "maj" },
      { off: 10, q: "maj" },
    ],
    swing: 0.16,
    bpmBias: 4,
  },
  {
    id: "violet",
    name: "VIOLET",
    root: 47, // B2
    prog: [
      { off: 0, q: "min" },
      { off: 5, q: "min" },
      { off: 10, q: "maj" },
      { off: 0, q: "min" },
    ],
    swing: 0,
    bpmBias: 8,
  },
  {
    id: "glacier",
    name: "GLACIER",
    root: 41, // F2
    prog: [
      { off: 8, q: "maj" },
      { off: 10, q: "maj" },
      { off: 0, q: "min" },
      { off: 3, q: "maj" },
    ],
    swing: 0,
    bpmBias: 6,
  },
  {
    id: "solar",
    name: "SOLAR",
    root: 44, // G#2
    prog: [
      { off: 0, q: "min" },
      { off: 1, q: "maj" },
      { off: 10, q: "maj" },
      { off: 8, q: "maj" },
    ],
    swing: 0.12,
    bpmBias: 12,
  },
  {
    id: "abyss",
    name: "ABYSS",
    root: 39, // D#2
    prog: [
      { off: 0, q: "min" },
      { off: 0, q: "min" },
      { off: 10, q: "maj" },
      { off: 5, q: "min" },
    ],
    swing: 0.2,
    bpmBias: 14,
  },
];

/** Minor pentatonic — every note in it works over every chord above. */
const PENT = [0, 3, 5, 7, 10] as const;

const triad = (c: Chord): number[] => (c.q === "min" ? [0, 3, 7] : [0, 4, 7]).map((i) => i + c.off);

/** Deterministic per-bar noise, so a replay of bar 91 sounds like bar 91. */
function barRng(bar: number, salt: number) {
  let a = (bar * 0x9e3779b1 + salt * 0x85ebca77) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ArrangeCtx = {
  /** 0..4 — how much of the band is playing */
  layer: number;
  /** dips to ~0.35 while a gate is being read, so the question can breathe */
  intensity: number;
};

/**
 * Schedule one bar of backing. `t0` is the absolute AudioContext time of beat 1
 * and `spb` is seconds-per-beat; both are supplied by the conductor so a tempo
 * change lands exactly on a bar line.
 */
export function scheduleBar(
  eng: AudioEngine,
  t0: number,
  spb: number,
  bar: number,
  sector: Sector,
  ctx: ArrangeCtx,
): void {
  const chord = sector.prog[bar % sector.prog.length]!;
  const rng = barRng(bar, sector.root);
  const barDur = spb * 4;
  const { layer, intensity } = ctx;
  const lvl = 0.55 + intensity * 0.45;

  const chordRoot = sector.root + chord.off;
  const tones = triad(chord);

  /* ---- pad ---------------------------------------------------------- */
  const padNotes = tones.map((i) => sector.root + 24 + i);
  if (layer >= 2) padNotes.push(sector.root + 36 + tones[1]!); // open it up
  if (layer >= 4) padNotes.push(sector.root + 26 + chord.off); // add the 9th
  eng.pad(t0, barDur * 0.99, padNotes, (0.9 + layer * 0.06) * lvl);

  /* ---- bass --------------------------------------------------------- */
  // beat, duration-in-beats, semitones above the chord root
  const flat: readonly [number, number, number][] = [
    [0, 1.9, 0],
    [2, 1.9, 0],
  ];
  const drive: readonly [number, number, number][] = [
    [0, 0.9, 0],
    [1.5, 0.4, 0],
    [2, 0.9, 7],
    [3, 0.4, 0],
    [3.5, 0.4, 12],
  ];
  const runner: readonly [number, number, number][] = [
    [0, 0.45, 0],
    [0.75, 0.2, 0],
    [1.5, 0.45, 12],
    [2, 0.45, 0],
    [2.75, 0.2, 7],
    [3.5, 0.45, 10],
  ];
  const bassPat = layer >= 3 ? runner : layer >= 1 ? drive : flat;
  for (const [b, d, semi] of bassPat) {
    eng.bass(t0 + b * spb, d * spb, chordRoot + semi, (0.95 + layer * 0.04) * lvl);
  }

  /* ---- pulse: the clock, always present ----------------------------- */
  // Quiet enough to sit under the player's own drums, loud enough that a bar
  // with no notes still has a beat you can feel.
  const pulseDiv = layer >= 2 ? 8 : 4;
  for (let i = 0; i < pulseDiv; i++) {
    const swung = i % 2 === 1 ? sector.swing * 0.5 : 0;
    const t = t0 + ((i + swung) / pulseDiv) * 4 * spb;
    const accent = i % (pulseDiv / 2) === 0;
    eng.hat(t, (accent ? 0.2 : 0.11) * lvl, false);
  }

  /* ---- arpeggio ----------------------------------------------------- */
  if (layer >= 1) {
    const pool = [tones[0]!, tones[1]!, tones[2]!, tones[0]! + 12, tones[2]!, tones[1]!];
    const steps = layer >= 3 ? 8 : 4;
    for (let i = 0; i < steps; i++) {
      if (layer < 3 && rng() < 0.25) continue;
      const swung = i % 2 === 1 ? sector.swing * 0.5 : 0;
      const t = t0 + ((i + swung) / steps) * 4 * spb;
      eng.arp(t, sector.root + 24 + pool[i % pool.length]!, (0.8 + layer * 0.05) * lvl);
    }
  }

  /* ---- counter-melody ------------------------------------------------ */
  if (layer >= 3) {
    const slots = [0, 1.5, 2.5, 3.5];
    for (const b of slots) {
      if (rng() < 0.42) continue;
      const deg = PENT[Math.floor(rng() * PENT.length)]!;
      const oct = layer >= 4 && rng() < 0.4 ? 12 : 0;
      eng.lead(t0 + b * spb, spb * 0.9, sector.root + 36 + deg + oct, (0.9 + layer * 0.05) * lvl);
    }
  }

  /* ---- shimmer ------------------------------------------------------- */
  if (layer >= 4 && bar % 2 === 0) {
    const deg = PENT[Math.floor(rng() * PENT.length)]!;
    eng.bell(t0 + 3.5 * spb, sector.root + 48 + deg, 0.5 * lvl, 0.9, 0.75);
  }
}

/** A short cadence played when a gate answer is correct — a musical "yes". */
export function cadence(eng: AudioEngine, t: number, spb: number, sector: Sector, up: boolean): void {
  const seq = up ? [0, 3, 7, 12] : [12, 10, 7, 3];
  for (let i = 0; i < seq.length; i++) {
    eng.bell(t + i * spb * 0.16, sector.root + 48 + seq[i]!, 0.85 - i * 0.08, 0.7, 0.7);
  }
}
