/**
 * sounds.ts — sound DESIGN. Maps high-level game cues to layered synth voices.
 *
 * All sounds are procedurally synthesized (no bundled audio files), keeping the
 * pack fully offline with zero binary weight. Everything is tuned to the same
 * C-minor synthwave palette as the MusicBed so SFX sit *inside* the track
 * rather than fighting it, and each cue gets a touch of the engine's shared
 * reverb for a cohesive, premium "room".
 *
 * The hit chime walks up a pentatonic scale as the combo grows, so a long
 * streak literally sounds like a rising melody — pure dopamine.
 */

import type { SynthEngine } from "./SynthEngine";

// A major-pentatonic scale (C D E G A) across a few octaves. Pentatonic means
// consecutive notes always sound consonant, so an ascending combo never
// produces a sour interval no matter how high it climbs, and it sits happily
// over the Cm bed (shared C tonic).
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
 * Correct hit: a bright multi-partial bell that rises with the combo. Layers:
 *   - a triangle fundamental (the note),
 *   - a sine octave shimmer (the "ting"),
 *   - a fifth sparkle on bigger combos (richness),
 *   - a soft sine sub for body/weight,
 *   - a bandpassed noise tick for attack snap.
 * Each carries a light reverb send so hits bloom into the synthwave space.
 */
export function playHit(synth: SynthEngine, combo: number, lanePan: number): void {
  const f = comboPitch(combo);
  const pan = lanePan * 0.6;

  // Fundamental bell.
  synth.playVoice({
    type: "triangle",
    freq: f,
    gain: 0.32,
    attack: 0.004,
    release: 0.17,
    pan,
    reverb: 0.22,
  });
  // Shimmer partial an octave up — gives the "ting".
  synth.playVoice({
    type: "sine",
    freq: f * 2,
    gain: 0.16,
    attack: 0.003,
    release: 0.13,
    pan,
    reverb: 0.3,
  });
  // Perfect-fifth sparkle for richness on bigger combos.
  if (combo >= 3) {
    synth.playVoice({
      type: "sine",
      freq: f * 3,
      gain: 0.08,
      attack: 0.003,
      release: 0.1,
      pan,
      reverb: 0.35,
    });
  }
  // Soft sub gives the chime weight on phone speakers.
  synth.playVoice({
    type: "sine",
    freq: f / 2,
    gain: 0.07,
    attack: 0.004,
    release: 0.12,
    pan: pan * 0.4,
  });
  // Attack transient — crisp pick of light.
  synth.playNoise({
    gain: 0.12,
    dur: 0.05,
    cutoff: 7200,
    cutoffTo: 2500,
    filter: "bandpass",
    q: 0.7,
    pan,
  });
}

/**
 * Wrong tap: a detuned downward "thunk" + a short low noise thud. Kept soft and
 * non-punitive (this is a learning game — a wrong tap shouldn't sting). Slight
 * reverb so it doesn't sound disconnected from the polished hits.
 */
export function playMiss(synth: SynthEngine, lanePan: number): void {
  const pan = lanePan * 0.5;
  synth.playVoice({
    type: "sawtooth",
    freq: 196,
    freqTo: 104,
    gain: 0.2,
    attack: 0.004,
    release: 0.2,
    pan,
    detune: -12,
    reverb: 0.12,
  });
  synth.playNoise({
    gain: 0.16,
    dur: 0.15,
    cutoff: 900,
    cutoffTo: 200,
    filter: "lowpass",
    q: 0.6,
    pan,
    reverb: 0.1,
  });
}

/**
 * Target slipped past unanswered: softer, sadder descending sine pair — a
 * gentle "you missed that one" without a hard buzz. More reverb for a wistful,
 * receding feel.
 */
export function playPassed(synth: SynthEngine): void {
  synth.playVoice({
    type: "sine",
    freq: 330,
    freqTo: 247,
    gain: 0.13,
    attack: 0.01,
    release: 0.3,
    reverb: 0.4,
  });
  synth.playVoice({
    type: "sine",
    freq: 247,
    freqTo: 175,
    gain: 0.1,
    attack: 0.02,
    release: 0.32,
    delay: 0.05,
    reverb: 0.45,
  });
}

/**
 * Combo milestone (every N): an ascending arpeggio "riser" that scales its
 * brightness and octave with the milestone tier. This is the celebratory
 * ear-candy — the moment a streak crosses 5/10/15… A bright whoosh underneath
 * gives it lift, and a sub-thump lands the arrival.
 */
export function playMilestone(synth: SynthEngine, tier: number): void {
  const base = 523.25; // C5
  const arp = [1, 5 / 4, 3 / 2, 2]; // C E G C — a major triad + octave
  const t = Math.min(tier, 5);
  const octShift = Math.pow(2, Math.floor(t / 3)); // climbs an octave at big tiers
  arp.forEach((ratio, i) => {
    synth.playVoice({
      type: "triangle",
      freq: base * ratio * octShift,
      gain: 0.2,
      attack: 0.005,
      release: 0.24,
      delay: i * 0.06,
      pan: i % 2 === 0 ? -0.3 : 0.3,
      reverb: 0.4,
    });
    // Octave shimmer on top.
    synth.playVoice({
      type: "sine",
      freq: base * ratio * 2 * octShift,
      gain: 0.08,
      attack: 0.004,
      release: 0.18,
      delay: i * 0.06,
      reverb: 0.5,
    });
  });
  // A bright rising whoosh underneath for "lift".
  synth.playNoise({
    gain: 0.13,
    dur: 0.34,
    cutoff: 500,
    cutoffTo: 6500,
    filter: "bandpass",
    q: 0.8,
    reverb: 0.3,
  });
  // Sub-thump on the arrival so the riser "lands".
  synth.playVoice({
    type: "sine",
    freq: 130.81 * octShift, // C3
    gain: 0.16,
    attack: 0.006,
    release: 0.4,
    delay: arp.length * 0.06,
  });
}

/**
 * Combo streak broken (was high, dropped to 0): a quick deflating glissando —
 * a tasteful "aww", not a punishment buzz.
 */
export function playComboBreak(synth: SynthEngine): void {
  synth.playVoice({
    type: "square",
    freq: 440,
    freqTo: 123,
    gain: 0.13,
    attack: 0.005,
    release: 0.34,
    reverb: 0.18,
  });
  synth.playVoice({
    type: "sine",
    freq: 220,
    freqTo: 82,
    gain: 0.1,
    attack: 0.008,
    release: 0.38,
    reverb: 0.2,
  });
}

/**
 * Menu shown / UI ready: a welcoming, glassy stinger — a rising minor-add9
 * spread that announces the brand. Warm reverb, gentle, premium.
 */
export function playMenu(synth: SynthEngine): void {
  // C E♭ G B♭ D — a lush Cm9 spread, arpeggiated upward.
  const notes = [523.25, 622.25, 783.99, 932.33, 1174.66];
  notes.forEach((f, i) => {
    synth.playVoice({
      type: "triangle",
      freq: f,
      gain: i === 0 ? 0.14 : 0.1,
      attack: 0.012,
      release: 0.34,
      delay: i * 0.07,
      pan: i % 2 === 0 ? -0.22 : 0.22,
      reverb: 0.5,
    });
  });
  // A soft pad swell underneath grounds the chime.
  synth.playVoice({
    type: "sine",
    freq: 261.63, // C4
    gain: 0.08,
    attack: 0.1,
    release: 0.6,
    reverb: 0.45,
  });
}

/**
 * Game start: an energetic upward "let's go" swell that lifts straight into the
 * music bed. Detuned saw stab + a filter-opening whoosh + a downbeat sub.
 */
export function playStart(synth: SynthEngine): void {
  synth.playVoice({
    type: "triangle",
    freq: 392, // G4
    freqTo: 784, // G5
    gain: 0.2,
    attack: 0.02,
    release: 0.32,
    reverb: 0.3,
  });
  // Detuned saw stab for synthwave grit.
  synth.playVoice({
    type: "sawtooth",
    freq: 261.63,
    gain: 0.1,
    attack: 0.01,
    release: 0.3,
    detune: 8,
    reverb: 0.25,
  });
  synth.playNoise({
    gain: 0.14,
    dur: 0.36,
    cutoff: 400,
    cutoffTo: 7200,
    filter: "bandpass",
    q: 0.7,
    reverb: 0.3,
  });
  // Downbeat sub "boom" to kick off the run.
  synth.playVoice({
    type: "sine",
    freq: 65.41, // C2
    gain: 0.18,
    attack: 0.008,
    release: 0.45,
    delay: 0.18,
  });
}

/**
 * Game over: a descending minor "sting" — three falling notes that resolve with
 * a low body tone and a dark filtered fall. Dramatic without being harsh, and
 * drenched in reverb so the run ends in a big synthwave room.
 */
export function playGameOver(synth: SynthEngine): void {
  const notes = [659.25, 523.25, 415.3]; // E5 → C5 → G#4 (falling)
  notes.forEach((f, i) => {
    synth.playVoice({
      type: "triangle",
      freq: f,
      gain: 0.2,
      attack: 0.008,
      release: 0.42,
      delay: i * 0.16,
      pan: 0,
      reverb: 0.5,
    });
  });
  // Low resolving body.
  synth.playVoice({
    type: "sine",
    freq: 130.81, // C3
    gain: 0.16,
    attack: 0.02,
    release: 0.95,
    delay: 0.48,
    reverb: 0.4,
  });
  synth.playNoise({
    gain: 0.1,
    dur: 0.6,
    cutoff: 3000,
    cutoffTo: 180,
    filter: "lowpass",
    q: 0.5,
    delay: 0.48,
    reverb: 0.35,
  });
}

/**
 * Decoy DODGED (issue #429): the player correctly let a distractor sail past.
 * A bright, airy "phew + sparkle" — a quick rising two-note chime over a soft
 * upward noise swish (the foil whooshing harmlessly by). Positive and light:
 * it celebrates the correct avoidance without competing with the fuller catch
 * bell, so dodging FEELS rewarding but reads as secondary to a real catch.
 */
export function playDecoyDodged(synth: SynthEngine, lanePan: number): void {
  const pan = lanePan * 0.5;
  // Rising two-note sparkle (a confident little "nice").
  synth.playVoice({
    type: "triangle",
    freq: 659.25, // E5
    freqTo: 987.77, // B5
    gain: 0.16,
    attack: 0.004,
    release: 0.16,
    pan,
    reverb: 0.32,
  });
  // Octave shimmer on top for a glint of "magic".
  synth.playVoice({
    type: "sine",
    freq: 1318.51, // E6
    gain: 0.07,
    attack: 0.003,
    release: 0.12,
    delay: 0.05,
    pan,
    reverb: 0.4,
  });
  // Soft upward air swish — the foil whooshing harmlessly past.
  synth.playNoise({
    gain: 0.08,
    dur: 0.22,
    cutoff: 1200,
    cutoffTo: 6000,
    filter: "bandpass",
    q: 0.9,
    pan,
    reverb: 0.3,
  });
}

/**
 * Wave verdict accent (learning-feel): a tiny confirm/deny ping layered on top
 * of the per-tap SFX when a whole wave resolves. Correct = a clean two-note
 * "up" affirmation; wrong/passed = a soft single low note. Subtle by design so
 * it reinforces the meaning-reveal moment without doubling the hit volume.
 */
export function playWaveVerdict(
  synth: SynthEngine,
  outcome: "correct" | "wrong" | "passed"
): void {
  if (outcome === "correct") {
    synth.playVoice({
      type: "sine",
      freq: 783.99, // G5
      freqTo: 1046.5, // C6
      gain: 0.1,
      attack: 0.006,
      release: 0.18,
      reverb: 0.45,
    });
  } else {
    // wrong or passed — a gentle, low confirmation that the wave closed.
    synth.playVoice({
      type: "sine",
      freq: 311.13, // E♭4
      freqTo: 261.63, // C4
      gain: 0.08,
      attack: 0.01,
      release: 0.24,
      reverb: 0.4,
    });
  }
}
