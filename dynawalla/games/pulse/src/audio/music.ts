/**
 * The harmony. A minor, four-bar loop, one chord per bar, so a whole bar is one
 * colour and the fraction gate that lands on that bar has a home key.
 *
 * Layers unlock as the player earns them. That is the reward: not a badge, a bass
 * player turning up.
 */

/** Semitone offset from A2 (110 Hz) → frequency. */
export function hz(semis: number): number {
  return 110 * Math.pow(2, semis / 12);
}

export type Chord = { root: number; quality: "min" | "maj" | "sus" };

/** i — VI — III — VII in A minor: Am, F, C, G. */
export const PROGRESSION: readonly Chord[] = [
  { root: 0, quality: "min" },
  { root: 8, quality: "maj" },
  { root: 3, quality: "maj" },
  { root: 10, quality: "maj" },
];

const TRIAD: Record<Chord["quality"], readonly number[]> = {
  min: [0, 3, 7],
  maj: [0, 4, 7],
  sus: [0, 5, 7],
};

export function chordAt(bar: number): Chord {
  return PROGRESSION[((bar % PROGRESSION.length) + PROGRESSION.length) % PROGRESSION.length]!;
}

/** Voiced up in the pad register. */
export function chordFreqs(c: Chord, octave = 2): number[] {
  return TRIAD[c.quality].map((s) => hz(c.root + s + 12 * octave));
}

/** A minor pentatonic — every note in it sounds right over every chord in the loop. */
export const PENTATONIC = [0, 3, 5, 7, 10] as const;

/**
 * The combo melody. Hit 1 is low, hit 40 is two octaves up and glittering. This is
 * the single strongest reason to keep a streak alive, and it costs nothing.
 */
export function comboNote(combo: number): number {
  const idx = combo % PENTATONIC.length;
  const oct = Math.min(3, Math.floor(combo / PENTATONIC.length));
  return hz(PENTATONIC[idx]! + 12 * (2 + oct));
}

export type LayerId = "bass" | "arp" | "pad" | "shaker";
export const LAYER_ORDER: readonly LayerId[] = ["bass", "pad", "arp", "shaker"];

/** Bass rhythm per stage tier, as beat offsets inside a bar. */
export const BASS_PATTERNS: readonly (readonly number[])[] = [
  [0],
  [0, 2],
  [0, 1.5, 2],
  [0, 0.75, 2, 2.5],
  [0, 0.5, 1.5, 2, 3, 3.5],
];
