/**
 * MusicBed — an evolving, fully-synthesized synthwave bed with a TUNE LIBRARY.
 *
 * No audio files. A self-scheduling lookahead sequencer (the standard WebAudio
 * "clock" pattern) drives three sustained layers that all feed the engine's
 * dedicated music sub-bus:
 *
 *   1. PAD     — slow, warm two-oscillator chords drifting through the current
 *                tune's minor/modal progression. Always present while running.
 *   2. BASS    — a pulsing sub on the root, on every beat. The synthwave pulse.
 *   3. ARP     — a bright plucky arpeggio that FADES IN with combo intensity,
 *                so a hot streak literally adds sparkle to the music.
 *
 * VARIETY (deliverable 6): instead of one looping tune, the bed owns a LIBRARY
 * of ~16 procedural TUNES — each its own chord progression, arp pattern, wave
 * palette, and tempo band, tagged with an intensity tier (calm → driving). A
 * random ROTATION ORDER is chosen per session; the gentle opener always leads
 * (good for beginners). `nextTune()` advances to the next tune in the rotation
 * and the bed cross-fades into it at the next bar boundary so transitions never
 * jar. As the player's LEVEL climbs the bed also biases toward higher-energy
 * tunes and lifts the floor tempo, so the music picks up pace with progress.
 *
 * Intensity (0..1, driven by combo + level) controls: music-bus level (swell),
 * arp presence, bass drive, and a tempo lift on top of the tune's own band — so
 * the track tightens as the player heats up and relaxes when they cool down.
 *
 * Honors prefers-reduced-motion (passed in): when reduced, the bed runs at a
 * lower, steadier level with the arp suppressed — present but unobtrusive.
 *
 * BACKGROUNDING: the scheduler queues beats off ctx.currentTime. When the app
 * is hidden the engine SUSPENDS the AudioContext (freezing its clock), so the
 * bed's lookahead never runs ahead of a frozen game loop. On resume the clock
 * continues; resync() re-bases nextBeatTime to the live clock so the first
 * post-resume beat doesn't fire a backlog all at once.
 */

import type { SynthEngine } from "./SynthEngine";

/** Scheduler lookahead window (s) and tick cadence (ms). */
const LOOKAHEAD_S = 0.18;
const TICK_MS = 45;

/**
 * One chord: the chord's root (Hz, low octave) plus the third & fifth offsets
 * in semitones that build the triad. Minor-leaning but not bleak.
 */
interface ChordSpec {
  root: number; // Hz (bass octave)
  third: number; // semitones above root
  fifth: number; // semitones above root
}

/**
 * A TUNE — one self-contained motif in the library. Progression + arp pattern +
 * wave palette + tempo band + an energy tier (0 calm .. 1 driving) the level
 * ramp biases toward.
 */
interface Tune {
  name: string;
  progression: ChordSpec[];
  /** Arp degrees (semitones from the chord root, octave-shifted in scheduleArp). */
  arp: number[];
  /** Pad oscillator shape. */
  padWave: OscillatorType;
  /** Arp pluck shape. */
  arpWave: OscillatorType;
  /** Tempo band for this tune (BPM at idle .. BPM at full heat). */
  tempoMin: number;
  tempoMax: number;
  /** 0 (calm/beginner) .. 1 (driving) — used to bias selection by level. */
  energy: number;
}

const SEMI = (hz: number, semis: number) => hz * Math.pow(2, semis / 12);

/** Chord-root note table (low octave) so progressions read musically. */
const N = {
  C2: 65.41,
  Db2: 69.3,
  D2: 73.42,
  Eb2: 77.78,
  E2: 82.41,
  F2: 87.31,
  G2: 98.0,
  Ab2: 103.83,
  A2: 110.0,
  Bb2: 116.54,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  Eb3: 155.56,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
};

const MIN = { third: 3, fifth: 7 }; // minor triad
const MAJ = { third: 4, fifth: 7 }; // major triad
const c = (root: number, q: typeof MIN | typeof MAJ): ChordSpec => ({
  root,
  third: q.third,
  fifth: q.fifth,
});

/** Common arp shapes (semitones above chord root, run up & back in scheduleArp). */
const ARP_UPBACK = [12, 15, 19, 24, 19, 15];
const ARP_TRIAD = [12, 16, 19, 24];
const ARP_PENTA = [12, 15, 17, 19, 22, 19, 17, 15];
const ARP_WIDE = [12, 19, 24, 31, 24, 19];

/**
 * THE LIBRARY — 16 tunes spanning calm openers to driving outrun, all in
 * compatible keys (C/related minors + relative majors) so cross-fades between
 * any two land musically.
 */
const LIBRARY: Tune[] = [
  // --- calm / beginner band (energy < 0.34) ------------------------------
  {
    name: "Dusk Cm",
    progression: [c(N.C3, MIN), c(N.Ab2, MAJ), c(N.Eb3, MAJ), c(N.Bb2, MAJ)],
    arp: ARP_UPBACK,
    padWave: "sawtooth",
    arpWave: "triangle",
    tempoMin: 80,
    tempoMax: 98,
    energy: 0.1,
  },
  {
    name: "Glass Am",
    progression: [c(N.A2, MIN), c(N.F2, MAJ), c(N.C3, MAJ), c(N.G2, MAJ)],
    arp: ARP_TRIAD,
    padWave: "triangle",
    arpWave: "triangle",
    tempoMin: 82,
    tempoMax: 100,
    energy: 0.15,
  },
  {
    name: "Tide Dm",
    progression: [c(N.D3, MIN), c(N.Bb2, MAJ), c(N.F3, MAJ), c(N.C3, MAJ)],
    arp: ARP_PENTA,
    padWave: "sine",
    arpWave: "triangle",
    tempoMin: 84,
    tempoMax: 102,
    energy: 0.2,
  },
  {
    name: "Soft Em",
    progression: [c(N.E2, MIN), c(N.C3, MAJ), c(N.G2, MAJ), c(N.D3, MAJ)],
    arp: ARP_UPBACK,
    padWave: "sawtooth",
    arpWave: "sine",
    tempoMin: 84,
    tempoMax: 104,
    energy: 0.28,
  },
  // --- mid band (0.34 .. 0.66) -------------------------------------------
  {
    name: "Neon Cm",
    progression: [c(N.C3, MIN), c(N.G2, MIN), c(N.Ab2, MAJ), c(N.Bb2, MAJ)],
    arp: ARP_TRIAD,
    padWave: "sawtooth",
    arpWave: "square",
    tempoMin: 92,
    tempoMax: 112,
    energy: 0.4,
  },
  {
    name: "Cruise Gm",
    progression: [c(N.G2, MIN), c(N.Eb3, MAJ), c(N.Bb2, MAJ), c(N.F3, MAJ)],
    arp: ARP_PENTA,
    padWave: "sawtooth",
    arpWave: "triangle",
    tempoMin: 94,
    tempoMax: 114,
    energy: 0.46,
  },
  {
    name: "Pulse Fm",
    progression: [c(N.F2, MIN), c(N.Db2, MAJ), c(N.Ab2, MAJ), c(N.Eb3, MAJ)],
    arp: ARP_UPBACK,
    padWave: "sawtooth",
    arpWave: "square",
    tempoMin: 96,
    tempoMax: 116,
    energy: 0.52,
  },
  {
    name: "Drift Bm",
    progression: [c(N.B2, MIN), c(N.G2, MAJ), c(N.D3, MAJ), c(N.A2, MAJ)],
    arp: ARP_WIDE,
    padWave: "triangle",
    arpWave: "triangle",
    tempoMin: 98,
    tempoMax: 118,
    energy: 0.58,
  },
  {
    name: "Voltage Am",
    progression: [c(N.A2, MIN), c(N.E2, MIN), c(N.F2, MAJ), c(N.G2, MAJ)],
    arp: ARP_TRIAD,
    padWave: "sawtooth",
    arpWave: "square",
    tempoMin: 100,
    tempoMax: 120,
    energy: 0.64,
  },
  // --- driving band (>= 0.66) --------------------------------------------
  {
    name: "Run Cm",
    progression: [c(N.C3, MIN), c(N.Bb2, MAJ), c(N.Ab2, MAJ), c(N.G2, MIN)],
    arp: ARP_PENTA,
    padWave: "sawtooth",
    arpWave: "square",
    tempoMin: 106,
    tempoMax: 126,
    energy: 0.7,
  },
  {
    name: "Chase Dm",
    progression: [c(N.D3, MIN), c(N.C3, MAJ), c(N.Bb2, MAJ), c(N.A2, MAJ)],
    arp: ARP_WIDE,
    padWave: "sawtooth",
    arpWave: "square",
    tempoMin: 108,
    tempoMax: 128,
    energy: 0.76,
  },
  {
    name: "Surge Em",
    progression: [c(N.E2, MIN), c(N.D3, MAJ), c(N.C3, MAJ), c(N.B2, MAJ)],
    arp: ARP_TRIAD,
    padWave: "square",
    arpWave: "square",
    tempoMin: 110,
    tempoMax: 130,
    energy: 0.82,
  },
  {
    name: "Blaze Gm",
    progression: [c(N.G2, MIN), c(N.F3, MAJ), c(N.Eb3, MAJ), c(N.D3, MAJ)],
    arp: ARP_PENTA,
    padWave: "sawtooth",
    arpWave: "square",
    tempoMin: 112,
    tempoMax: 132,
    energy: 0.88,
  },
  {
    name: "Hyper Am",
    progression: [c(N.A2, MIN), c(N.G2, MAJ), c(N.F2, MAJ), c(N.E2, MAJ)],
    arp: ARP_WIDE,
    padWave: "square",
    arpWave: "square",
    tempoMin: 114,
    tempoMax: 134,
    energy: 0.92,
  },
  {
    name: "Overdrive Cm",
    progression: [c(N.C3, MIN), c(N.Eb3, MAJ), c(N.G3, MIN), c(N.Bb2, MAJ)],
    arp: ARP_PENTA,
    padWave: "square",
    arpWave: "square",
    tempoMin: 116,
    tempoMax: 138,
    energy: 0.96,
  },
  {
    name: "Afterburn Dm",
    progression: [c(N.D3, MIN), c(N.A2, MIN), c(N.Bb2, MAJ), c(N.C3, MAJ)],
    arp: ARP_WIDE,
    padWave: "square",
    arpWave: "square",
    tempoMin: 118,
    tempoMax: 140,
    energy: 1.0,
  },
];

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
  /** 0..1 level floor from player LEVEL — biases tune choice + lifts tempo. */
  private levelEnergy = 0;

  /** Per-session randomized rotation order over LIBRARY indices. */
  private rotation: number[] = [];
  /** Pointer into `rotation`. */
  private rotIdx = 0;
  /** The tune currently playing. */
  private tune: Tune = LIBRARY[0];
  /** A pending tune to cross-fade into at the next bar boundary, if any. */
  private pendingTune: Tune | null = null;

  constructor(synth: SynthEngine, reducedMotion: boolean) {
    this.synth = synth;
    this.reduced = reducedMotion;
    this.chooseRotation();
  }

  /**
   * Pick a fresh random rotation for this session. The gentle opener (lowest
   * energy) ALWAYS leads — good for beginners — then the rest are shuffled.
   */
  chooseRotation(): void {
    const idxs = LIBRARY.map((_, i) => i);
    // Opener = the lowest-energy tune.
    let openerIdx = 0;
    for (let i = 1; i < LIBRARY.length; i++) {
      if (LIBRARY[i].energy < LIBRARY[openerIdx].energy) openerIdx = i;
    }
    const rest = idxs.filter((i) => i !== openerIdx);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.rotation = [openerIdx, ...rest];
    this.rotIdx = 0;
    this.tune = LIBRARY[this.rotation[0]];
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
   * RESYNC after the AudioContext was suspended/resumed (backgrounding). The
   * scheduler queues beats off ctx.currentTime; while suspended the clock froze,
   * so nextBeatTime now points into the past relative to the resumed clock.
   * Re-base it to "just ahead of now" so the bed resumes cleanly instead of
   * machine-gunning a backlog of overdue beats. Cheap + safe to over-call.
   */
  resync(): void {
    const ctx = this.synth.context;
    if (!ctx || !this.running) return;
    if (this.nextBeatTime < ctx.currentTime) {
      this.nextBeatTime = ctx.currentTime + 0.08;
    }
  }

  /**
   * Advance to the NEXT tune in the session rotation. Used on round/level
   * transitions to keep the music fresh. The new tune is queued and swapped at
   * the next bar boundary so the change lands musically (never mid-phrase). When
   * the level is high we bias the pick toward higher-energy tunes.
   */
  nextTune(): void {
    let pick: Tune;
    if (this.levelEnergy > 0.45) {
      // Bias toward driving tunes as the player climbs: scan a few candidates
      // in the rotation and take the most energetic that isn't the current one.
      let best: Tune | null = null;
      for (let k = 1; k <= 4; k++) {
        const t = LIBRARY[this.rotation[(this.rotIdx + k) % this.rotation.length]];
        if (t === this.tune) continue;
        if (!best || Math.abs(t.energy - this.levelEnergy) < Math.abs(best.energy - this.levelEnergy)) {
          best = t;
        }
      }
      this.rotIdx = (this.rotIdx + 1) % this.rotation.length;
      pick = best ?? LIBRARY[this.rotation[this.rotIdx]];
    } else {
      this.rotIdx = (this.rotIdx + 1) % this.rotation.length;
      pick = LIBRARY[this.rotation[this.rotIdx]];
    }
    if (pick === this.tune) return;
    this.pendingTune = pick;
  }

  /** The name of the tune currently playing (introspection / debug). */
  get tuneName(): string {
    return this.tune.name;
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

  /**
   * Feed the player's LEVEL (1-based) so the bed picks up pace with progress:
   * lifts the intensity floor and biases tune rotation toward higher energy.
   */
  setLevel(level: number): void {
    const lv = Math.max(1, level | 0);
    this.levelEnergy = Math.min(1, (lv - 1) / 12);
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
    // Combine combo intensity with the level floor so the tune speeds up both
    // on a hot streak AND as the player levels up.
    const i = this.reduced ? 0 : Math.max(this.intensity, this.levelEnergy * 0.6);
    return this.tune.tempoMin + (this.tune.tempoMax - this.tune.tempoMin) * i;
  }

  /** The scheduler: queue every beat that falls inside the lookahead window. */
  private tick(): void {
    const ctx = this.synth.context;
    if (!this.running || !ctx || !this.synth.ready) return;

    // If the clock jumped (resume from background), re-base before scheduling.
    this.resync();

    // Ease the smoothed intensity toward target (per-tick low-pass), but never
    // below the level floor so progression keeps a bit of drive.
    const floor = this.levelEnergy * 0.35;
    const tgt = Math.max(this.targetIntensity, floor);
    this.intensity += (tgt - this.intensity) * 0.12;

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

    // TUNE SWAP at bar boundaries only, so the cross-fade lands musically.
    if (beatInBar === 0 && this.pendingTune) {
      this.tune = this.pendingTune;
      this.pendingTune = null;
    }

    const prog = this.tune.progression;
    const chord = prog[bar % prog.length];

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

  /** Two slightly-detuned oscillators + width = warm outrun pad (tune wave). */
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
        type: this.tune.padWave,
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
        type: this.tune.padWave,
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

  /** A bright pluck walking the tune's arp pattern in 16ths. */
  private scheduleArp(
    chord: ChordSpec,
    delay: number,
    secPerBeat: number,
    beat: number
  ): void {
    const sixteenth = secPerBeat / 4;
    const base = chord.root * 2;
    const pattern = this.tune.arp;
    const presence = Math.min(1, (this.intensity - 0.12) / 0.6);
    for (let s = 0; s < 4; s++) {
      const stepIdx = (beat * 4 + s) % pattern.length;
      const f = SEMI(base, pattern[stepIdx]);
      this.synth.playVoice({
        type: this.tune.arpWave,
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
