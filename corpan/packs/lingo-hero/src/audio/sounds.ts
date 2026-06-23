/**
 * sounds.ts — sound DESIGN. Maps high-level game cues to layered synth voices.
 *
 * All sounds are procedurally synthesized (no bundled audio files), keeping the
 * pack fully offline with zero binary weight. The hit chime walks up a
 * pentatonic scale as the combo grows, so a long streak literally sounds like a
 * rising melody — pure dopamine.
 */

import type { SynthEngine } from "./SynthEngine";

// A major pentatonic scale (C, D, E, G, A) across a couple octaves. Pentatonic
// means consecutive notes always sound consonant, so an ascending combo never
// produces a sour interval no matter how high it climbs.
const PENTATONIC_Hz: number[] = (() => {
  const root = 523.25; // C5
  const ratios = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3]; // C D E G A
  const out: number[] = [];
  for (let octave = 0; octave < 3; octave++) {
    for (const r of ratios) {
      out.push(root * r * Math.pow(2, octave));
    }
  }
  return out;
})();

function comboPitch(combo: number): number {
  // Clamp the index so very long streaks plateau near the top of the scale
  // instead of becoming inaudibly shrill.
  const idx = Math.min(PENTATONIC_Hz.length - 1, Math.max(0, combo));
  return PENTATONIC_Hz[idx];
}

/**
 * Correct hit: a bright two-partial bell that rises with the combo, plus a
 * tiny noise "tick" transient for attack snap and a faint sub for body.
 */
export function playHit(synth: SynthEngine, combo: number, lanePan: number): void {
  const f = comboPitch(combo);

  // Fundamental bell.
  synth.playVoice({
    type: "triangle",
    freq: f,
    gain: 0.32,
    attack: 0.004,
    release: 0.16,
    pan: lanePan * 0.6,
  });
  // Shimmer partial an octave up — gives the "ting".
  synth.playVoice({
    type: "sine",
    freq: f * 2,
    gain: 0.16,
    attack: 0.003,
    release: 0.12,
    pan: lanePan * 0.6,
  });
  // Perfect-fifth sparkle for richness on bigger combos.
  if (combo >= 3) {
    synth.playVoice({
      type: "sine",
      freq: f * 3,
      gain: 0.08,
      attack: 0.003,
      release: 0.09,
      pan: lanePan * 0.6,
    });
  }
  // Attack transient.
  synth.playNoise({
    gain: 0.12,
    dur: 0.05,
    cutoff: 7000,
    cutoffTo: 2500,
    filter: "bandpass",
    q: 0.7,
    pan: lanePan * 0.6,
  });
}

/** Wrong tap: a detuned downward "thunk" + a short low noise thud. */
export function playMiss(synth: SynthEngine, lanePan: number): void {
  synth.playVoice({
    type: "sawtooth",
    freq: 196,
    freqTo: 110,
    gain: 0.22,
    attack: 0.004,
    release: 0.18,
    pan: lanePan * 0.5,
    detune: -12,
  });
  synth.playNoise({
    gain: 0.18,
    dur: 0.14,
    cutoff: 900,
    cutoffTo: 220,
    filter: "lowpass",
    q: 0.6,
    pan: lanePan * 0.5,
  });
}

/** Target slipped past unanswered: softer, sadder descending sine. */
export function playPassed(synth: SynthEngine): void {
  synth.playVoice({
    type: "sine",
    freq: 330,
    freqTo: 247,
    gain: 0.14,
    attack: 0.01,
    release: 0.28,
  });
  synth.playVoice({
    type: "sine",
    freq: 247,
    freqTo: 185,
    gain: 0.1,
    attack: 0.02,
    release: 0.3,
    delay: 0.04,
  });
}

/**
 * Combo milestone (every N): an ascending arpeggio "riser" that scales its
 * brightness with the milestone tier. This is the celebratory ear-candy.
 */
export function playMilestone(synth: SynthEngine, tier: number): void {
  const base = 523.25; // C5
  const arp = [1, 5 / 4, 3 / 2, 2]; // C E G C — a major triad + octave
  const t = Math.min(tier, 5);
  arp.forEach((ratio, i) => {
    synth.playVoice({
      type: "triangle",
      freq: base * ratio * Math.pow(2, Math.floor(t / 3)),
      gain: 0.2,
      attack: 0.005,
      release: 0.22,
      delay: i * 0.06,
      pan: i % 2 === 0 ? -0.3 : 0.3,
    });
    // Octave shimmer on top.
    synth.playVoice({
      type: "sine",
      freq: base * ratio * 2,
      gain: 0.08,
      attack: 0.004,
      release: 0.16,
      delay: i * 0.06,
    });
  });
  // A bright whoosh underneath for "lift".
  synth.playNoise({
    gain: 0.12,
    dur: 0.3,
    cutoff: 600,
    cutoffTo: 6000,
    filter: "bandpass",
    q: 0.8,
  });
}

/** Combo streak broken (was high, dropped to 0): a quick deflating glissando. */
export function playComboBreak(synth: SynthEngine): void {
  synth.playVoice({
    type: "square",
    freq: 440,
    freqTo: 130,
    gain: 0.14,
    attack: 0.005,
    release: 0.32,
  });
}

/** Menu shown / UI ready: a gentle welcoming two-note chime. */
export function playMenu(synth: SynthEngine): void {
  synth.playVoice({
    type: "sine",
    freq: 587.33, // D5
    gain: 0.14,
    attack: 0.01,
    release: 0.25,
  });
  synth.playVoice({
    type: "sine",
    freq: 880, // A5
    gain: 0.12,
    attack: 0.01,
    release: 0.3,
    delay: 0.11,
  });
}

/** Game start: an energetic upward "let's go" swell. */
export function playStart(synth: SynthEngine): void {
  synth.playVoice({
    type: "triangle",
    freq: 392, // G4
    freqTo: 784, // G5
    gain: 0.2,
    attack: 0.02,
    release: 0.3,
  });
  synth.playNoise({
    gain: 0.14,
    dur: 0.35,
    cutoff: 400,
    cutoffTo: 7000,
    filter: "bandpass",
    q: 0.7,
  });
}

/**
 * Game over: a descending minor "sting" — three falling notes that resolve
 * with a low body tone. Dramatic without being harsh.
 */
export function playGameOver(synth: SynthEngine): void {
  const notes = [659.25, 523.25, 415.3]; // E5 → C5 → G#4 (falling)
  notes.forEach((f, i) => {
    synth.playVoice({
      type: "triangle",
      freq: f,
      gain: 0.2,
      attack: 0.008,
      release: 0.4,
      delay: i * 0.16,
      pan: 0,
    });
  });
  // Low resolving body.
  synth.playVoice({
    type: "sine",
    freq: 130.81, // C3
    gain: 0.16,
    attack: 0.02,
    release: 0.9,
    delay: 0.48,
  });
  synth.playNoise({
    gain: 0.1,
    dur: 0.6,
    cutoff: 3000,
    cutoffTo: 200,
    filter: "lowpass",
    q: 0.5,
    delay: 0.48,
  });
}
