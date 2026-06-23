/**
 * MusicBed — an evolving, fully-synthesized synthwave bed.
 *
 * No audio files. A self-scheduling lookahead sequencer (the standard WebAudio
 * "clock" pattern) drives three sustained layers that all feed the engine's
 * dedicated music sub-bus:
 *
 *   1. PAD     — slow, warm two-oscillator chords drifting through a minor
 *                progression. Always present while the bed runs.
 *   2. BASS     — a pulsing sub on the root, on every beat. The synthwave pulse.
 *   3. ARP     — a bright plucky arpeggio that FADES IN with combo intensity,
 *                so a hot streak literally adds sparkle to the music.
 *
 * Intensity (0..1, driven by combo) controls: music-bus level (swell), arp
 * presence, bass drive, and a gentle tempo lift — so the track tightens as the
 * player heats up and relaxes when they cool down. The whole thing is keyed to
 * the same C-minor synthwave palette as the SFX so cues sit in the music.
 *
 * Honors prefers-reduced-motion (passed in): when reduced, the bed runs at a
 * lower, steadier level with the arp suppressed — present but unobtrusive.
 */

import type { SynthEngine } from "./SynthEngine";

/** One bar = 4 beats; tempo glides between these with intensity. */
const TEMPO_MIN = 84; // BPM at idle
const TEMPO_MAX = 104; // BPM at full heat

/** Scheduler lookahead window (s) and tick cadence (ms). */
const LOOKAHEAD_S = 0.18;
const TICK_MS = 45;

/**
 * Cm synthwave progression: Cm – A♭ – E♭ – B♭ (i – VI – III – VII). Each entry
 * is the chord's root (Hz, low octave) plus the third & fifth offsets in
 * semitones that build the triad. Minor-leaning but not bleak — classic
 * outrun harmony.
 */
interface ChordSpec {
  root: number; // Hz (bass octave)
  third: number; // semitones above root
  fifth: number; // semitones above root
}

const SEMI = (hz: number, semis: number) => hz * Math.pow(2, semis / 12);

const PROGRESSION: ChordSpec[] = [
  { root: 130.81, third: 3, fifth: 7 }, // Cm   (C3, E♭, G)
  { root: 103.83, third: 4, fifth: 7 }, // A♭   (A♭2, C,  E♭)
  { root: 155.56, third: 4, fifth: 7 }, // E♭   (E♭3, G,  B♭)
  { root: 116.54, third: 4, fifth: 7 }, // B♭   (B♭2, D,  F)
];

/** Pentatonic-ish arp degrees (semitones from chord root) for the sparkle layer. */
const ARP_DEGREES = [12, 15, 19, 24, 19, 15]; // root, m3, 5, octave, 5, m3 (up & back)

export class MusicBed {
  private readonly synth: SynthEngine;
  private readonly reduced: boolean;

  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Next beat's scheduled context-time. */
  private nextBeatTime = 0;
  /** Global beat counter since start (drives bar/chord position). */
  private beat = 0;

  /** Smoothed 0..1 intensity that the bed reacts to. */
  private intensity = 0;
  /** Raw target intensity set from combo; `intensity` chases this. */
  private targetIntensity = 0;

  constructor(synth: SynthEngine, reducedMotion: boolean) {
    this.synth = synth;
    this.reduced = reducedMotion;
  }

  /** Begin the bed. Safe to call repeatedly; no-op if already running. */
  start(): void {
    if (this.running) return;
    const ctx = this.synth.context;
    if (!ctx || !this.synth.ready) return;
    this.running = true;
    this.beat = 0;
    this.nextBeatTime = ctx.currentTime + 0.08;
    // Swell the music bus up from silence to a calm idle level.
    this.synth.setMusicLevel(this.reduced ? 0.18 : this.baseLevel(), 1.4);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Fade the bed out and stop scheduling. */
  stop(fade = 0.8): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.synth.setMusicLevel(0, fade);
  }

  /**
   * Set how "hot" the music should feel from the current combo. Mapped to a
   * 0..1 target intensity; the bed eases toward it so changes never jolt.
   */
  setCombo(combo: number): void {
    // Saturating curve: first few hits lift quickly, then it plateaus.
    const t = 1 - Math.exp(-combo / 9);
    this.targetIntensity = Math.max(0, Math.min(1, t));
  }

  /** Drop intensity instantly on a streak break (music "cools"). */
  cool(): void {
    this.targetIntensity = 0;
  }

  /** Idle music-bus level before intensity is added in. */
  private baseLevel(): number {
    return 0.26;
  }

  /** Tear down. */
  dispose(): void {
    this.stop(0.2);
  }

  private currentTempo(): number {
    const i = this.reduced ? 0 : this.intensity;
    return TEMPO_MIN + (TEMPO_MAX - TEMPO_MIN) * i;
  }

  /** The scheduler: queue every beat that falls inside the lookahead window. */
  private tick(): void {
    const ctx = this.synth.context;
    if (!this.running || !ctx || !this.synth.ready) return;

    // Ease the smoothed intensity toward target (per-tick low-pass).
    this.intensity += (this.targetIntensity - this.intensity) * 0.12;

    // React: music level swells with intensity; arp/tempo follow inside notes.
    if (!this.reduced) {
      const level = this.baseLevel() + this.intensity * 0.34; // 0.26 .. 0.60
      this.synth.setMusicLevel(level, 0.5);
    }

    const secPerBeat = 60 / this.currentTempo();
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    while (this.nextBeatTime < horizon) {
      this.scheduleBeat(this.beat, this.nextBeatTime);
      this.nextBeatTime += secPerBeat;
      this.beat++;
    }
  }

  /** Lay down all layers for one beat at absolute context-time `when`. */
  private scheduleBeat(beat: number, when: number): void {
    const ctx = this.synth.context;
    if (!ctx) return;
    const now = ctx.currentTime;
    const delay = Math.max(0, when - now);
    const secPerBeat = 60 / this.currentTempo();

    const beatInBar = beat % 4;
    const bar = Math.floor(beat / 4);
    const chord = PROGRESSION[bar % PROGRESSION.length];

    // --- PAD: new chord swells at the top of each bar (long, soft) ----------
    if (beatInBar === 0) {
      this.schedulePad(chord, delay, secPerBeat * 4);
    }

    // --- BASS: a sub pulse on every beat; harder with intensity ------------
    this.scheduleBass(chord, delay, secPerBeat, beatInBar);

    // --- ARP: 16th sparkle that fades in with intensity --------------------
    if (!this.reduced && this.intensity > 0.12) {
      this.scheduleArp(chord, delay, secPerBeat, beat);
    }
  }

  /** Two slightly-detuned saw oscillators + a sine sub = warm outrun pad. */
  private schedulePad(chord: ChordSpec, delay: number, dur: number): void {
    const tones = [
      chord.root * 2, // up an octave for the body
      SEMI(chord.root * 2, chord.third),
      SEMI(chord.root * 2, chord.fifth),
    ];
    const gain = 0.05 + this.intensity * 0.03;
    for (const f of tones) {
      // Detuned unison for analog width.
      this.synth.playVoice({
        type: "sawtooth",
        freq: f,
        gain,
        attack: dur * 0.32,
        release: dur * 0.66,
        delay,
        detune: -7,
        pan: -0.35,
        reverb: 0.5,
      });
      this.synth.playVoice({
        type: "sawtooth",
        freq: f,
        gain,
        attack: dur * 0.32,
        release: dur * 0.66,
        delay,
        detune: 7,
        pan: 0.35,
        reverb: 0.5,
      });
    }
  }

  /** Punchy sub on the root; downbeat is fuller than off-beats. */
  private scheduleBass(
    chord: ChordSpec,
    delay: number,
    secPerBeat: number,
    beatInBar: number
  ): void {
    const accent = beatInBar === 0 ? 1 : 0.7;
    const drive = 0.06 + this.intensity * 0.06;
    this.synth.playVoice({
      type: "sine",
      freq: chord.root,
      gain: drive * accent,
      attack: 0.006,
      release: secPerBeat * 0.7,
      delay,
    });
    // A square layer an octave up adds presence as it heats up.
    if (this.intensity > 0.3) {
      this.synth.playVoice({
        type: "square",
        freq: chord.root * 2,
        gain: 0.02 * this.intensity * accent,
        attack: 0.005,
        release: secPerBeat * 0.4,
        delay,
      });
    }
  }

  /** A bright triangle pluck walking the arp pattern in 16ths. */
  private scheduleArp(
    chord: ChordSpec,
    delay: number,
    secPerBeat: number,
    beat: number
  ): void {
    const sixteenth = secPerBeat / 4;
    const base = chord.root * 2;
    const presence = Math.min(1, (this.intensity - 0.12) / 0.6);
    for (let s = 0; s < 4; s++) {
      const stepIdx = (beat * 4 + s) % ARP_DEGREES.length;
      const f = SEMI(base, ARP_DEGREES[stepIdx]);
      this.synth.playVoice({
        type: "triangle",
        freq: f,
        gain: 0.035 * presence,
        attack: 0.004,
        release: sixteenth * 1.6,
        delay: delay + s * sixteenth,
        pan: s % 2 === 0 ? -0.25 : 0.25,
        reverb: 0.4,
      });
    }
  }
}
