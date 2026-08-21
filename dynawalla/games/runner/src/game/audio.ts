/**
 * VOLTA's whole sound world, synthesised. No files, no fetches, no licences.
 *
 * Every one-shot is built the same way — transient, body, tail — because that
 * is what makes a synthesised hit read as a physical event instead of a beep.
 * Pitch, filter cutoff and tail length are jittered on every trigger so the
 * two-hundredth spark of a run does not sound like the first.
 *
 * Nothing here carries information on its own: every cue has a visual twin, and
 * the whole graph can be muted without the game becoming unreadable.
 */

import { createSafetyBus, safeAttack } from "../../../../packs/shared/game-audio/index.ts";

const A4 = 440;
const mtof = (m: number) => A4 * Math.pow(2, (m - 69) / 12);

export type ScaleName = "aurora" | "solar" | "abyss" | "void";

const SCALES: Record<ScaleName, { root: number; degrees: number[] }> = {
  // A minor pentatonic — open, cool, no leading tone to nag.
  aurora: { root: 57, degrees: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] },
  // D dorian — brighter, drives forward.
  solar: { root: 50, degrees: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19] },
  // E phrygian — the pressure biome.
  abyss: { root: 52, degrees: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19] },
  // C lydian — the "you have gone somewhere else" biome.
  void: { root: 60, degrees: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19] },
};

/**
 * The ship's voice.
 *
 * ── what it was ─────────────────────────────────────────────────────────────
 *
 * A sawtooth at 52-86 Hz and a band of white noise, both into one lowpass with
 * **Q = 7**. That is not a spaceship; it is the standard recipe for a two-stroke
 * engine, and the founder heard it as exactly that — "static and annoying like a
 * 4-bit motorcycle". Two things did it. A sawtooth has every harmonic at 1/n, so
 * at 58 Hz there is significant energy right through the ear's most sensitive
 * band; and a Q of 7 puts a 17 dB resonant peak on a filter that is being swept
 * by the player's own speed, which is heard as a nasal whine that tracks them.
 *
 * ── what it is ──────────────────────────────────────────────────────────────
 *
 * Two triangles a few cents apart. A triangle's harmonics fall off at 1/n², so
 * it is warm at the same fundamental, and the detune makes the pair beat slowly
 * against each other — that beating is the "magical electrical" the founder
 * asked for, and it costs one extra oscillator. The filter's resonance comes
 * down to just above flat so the sweep reads as opening rather than whining, and
 * a quiet high partial drifts over the top for the space-age end of it. The
 * noise stays, because a bed with no noise at all sounds synthetic, but at a
 * quarter of what it was.
 *
 * And it is quieter. `ENGINE.gain` is a little over half the old curve at every
 * speed, and the wind band roughly half — the founder asked for that too, and a
 * bed is the one sound in a game that is never not playing.
 *
 * Exported as data rather than buried in `setDrive` so `audio.test.ts` can hold
 * it to those claims without a real `AudioContext`: quieter than the old curve
 * everywhere, no sawtooth, resonance under the whine threshold, detune non-zero.
 */
export const ENGINE = {
  /** The two body oscillators. Triangle, not sawtooth: 1/n² and not 1/n. */
  type: "triangle" as OscillatorType,
  /** The pair's shared trim into the body filter. */
  bodyGain: 0.3,
  /** Cents between the pair. Wide enough to beat, narrow enough to stay one note. */
  detuneCents: 9,
  /** Fundamental, in Hz, at rest and at terminal velocity. */
  hz: [52, 86] as const,
  /** The sub sine, an octave below and a touch flat of it. */
  subHz: [26, 41] as const,
  subGain: 0.38,
  /** Body filter. Q was 7 — a 17 dB peak swept by the player. */
  cutoffHz: [420, 1900] as const,
  q: 1.1,
  /** Noise into the body filter. Air, not grit. */
  noiseGain: 0.022,
  /** The high partial that drifts over the top, as a multiple of the fundamental. */
  shimmerMul: 6,
  shimmerGain: 0.014,
  /** How fast the shimmer breathes, in Hz. Slow enough to be weather. */
  shimmerLfoHz: 0.19,
  /** Bed level at rest and at terminal velocity. Was 0.13 and 0.24. */
  gain: [0.075, 0.13] as const,
  /** Level while dead. */
  deadGain: 0.014,
  /** The wind band. Was 0.006..0.056 at 700..2600 Hz. */
  windGain: [0.004, 0.032] as const,
  windHz: [520, 1670] as const,
} as const;

/** Everything the engine bed should be doing at `speed01`. */
export function engineAt(speed01: number, alive: boolean): {
  gain: number;
  cutoff: number;
  hz: number;
  subHz: number;
  windGain: number;
  windHz: number;
} {
  const s = Math.max(0, Math.min(1, speed01));
  const at = ([lo, hi]: readonly [number, number]): number => lo + (hi - lo) * s;
  return {
    gain: alive ? at(ENGINE.gain) : ENGINE.deadGain,
    cutoff: at(ENGINE.cutoffHz),
    hz: at(ENGINE.hz),
    subHz: at(ENGINE.subHz),
    windGain: alive ? at(ENGINE.windGain) : 0,
    windHz: at(ENGINE.windHz),
  };
}

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private delay!: DelayNode;
  private delayFb!: GainNode;
  private delayMix!: GainNode;
  private noiseBuf!: AudioBuffer;

  // engine bed
  private engOsc: OscillatorNode | null = null;
  /** The detuned twin. The beat between the two is the whole character. */
  private engOsc2: OscillatorNode | null = null;
  private engSub: OscillatorNode | null = null;
  private engShimmer: OscillatorNode | null = null;
  private engShimmerLfo: OscillatorNode | null = null;
  private engNoise: AudioBufferSourceNode | null = null;
  private engFilter!: BiquadFilterNode;
  private engGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private windGain!: GainNode;

  enabled = true;
  private started = false;
  private scale: ScaleName = "aurora";

  // sequencer
  private bpm = 126;
  private nextNoteTime = 0;
  private step = 0;
  private musicLayers = 0;

  /* ------------------------------ lifecycle ------------------------------ */

  /** Must be called from a user gesture. Safe to call repeatedly. */
  start(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    // Master chain: everything meets one limiter so a 10-particle pile-up cannot clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    // The last thing between this game and a child's ears. Everything the
    // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
    // going straight to the output. See packs/shared/game-audio/.
    const safety = createSafetyBus(ctx);
    limiter.connect(safety.input);

    this.master = ctx.createGain();
    // 0.65, not 0.85. `gateCorrect()` rendered at 0.942 on its own and six of
    // them reached 2.716 with 268 clipped samples — and a gate is the sound
    // this game makes most often.
    this.master.gain.value = 0.65;
    this.master.connect(limiter);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.42;
    this.musicBus.connect(this.master);

    // One shared feedback delay is the "tail" for every one-shot.
    this.delay = ctx.createDelay(1.2);
    this.delay.delayTime.value = 0.26;
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.34;
    this.delayMix = ctx.createGain();
    this.delayMix.gain.value = 0.5;
    const dampen = ctx.createBiquadFilter();
    dampen.type = "lowpass";
    dampen.frequency.value = 2600;
    this.delay.connect(dampen);
    dampen.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.delayMix);
    this.delayMix.connect(this.master);

    // 2s of white noise, reused everywhere.
    const n = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let s = 1;
    for (let i = 0; i < n; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x3fffffff) - 1;
    }

    this.buildEngine();
    this.nextNoteTime = ctx.currentTime + 0.1;
  }

  private buildEngine(): void {
    const ctx = this.ctx!;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engGain.connect(this.master);

    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = "lowpass";
    this.engFilter.frequency.value = ENGINE.cutoffHz[0];
    this.engFilter.Q.value = ENGINE.q;
    this.engFilter.connect(this.engGain);

    // The pair. Same note, `detuneCents` apart, so they drift in and out of
    // phase over a couple of seconds — an electrical shimmer rather than a tone.
    const bodyG = ctx.createGain();
    bodyG.gain.value = ENGINE.bodyGain;
    bodyG.connect(this.engFilter);
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = ENGINE.type;
    this.engOsc.frequency.value = ENGINE.hz[0];
    this.engOsc.detune.value = -ENGINE.detuneCents / 2;
    this.engOsc.connect(bodyG);
    this.engOsc.start();
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = ENGINE.type;
    this.engOsc2.frequency.value = ENGINE.hz[0];
    this.engOsc2.detune.value = ENGINE.detuneCents / 2;
    this.engOsc2.connect(bodyG);
    this.engOsc2.start();

    this.engSub = ctx.createOscillator();
    this.engSub.type = "sine";
    this.engSub.frequency.value = ENGINE.subHz[0];
    const subG = ctx.createGain();
    subG.gain.value = ENGINE.subGain;
    this.engSub.connect(subG);
    subG.connect(this.engGain);
    this.engSub.start();

    // A high partial that breathes. This is the space-age end of it, and it is
    // deliberately below the noise floor of anything else in the mix — it should
    // be noticeable only when it stops.
    this.engShimmer = ctx.createOscillator();
    this.engShimmer.type = "sine";
    this.engShimmer.frequency.value = ENGINE.hz[0] * ENGINE.shimmerMul;
    const shG = ctx.createGain();
    // Every GainNode arrives at 1, and an oscillator connected to an AudioParam
    // ADDS to that param rather than driving it — so the swing is split in two:
    // half is the param's own value and half is the LFO's depth. The partial
    // then breathes across [0, shimmerGain] and never inverts.
    shG.gain.value = ENGINE.shimmerGain / 2;
    this.engShimmer.connect(shG);
    shG.connect(this.engGain);
    this.engShimmer.start();
    this.engShimmerLfo = ctx.createOscillator();
    this.engShimmerLfo.type = "sine";
    this.engShimmerLfo.frequency.value = ENGINE.shimmerLfoHz;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = ENGINE.shimmerGain / 2;
    this.engShimmerLfo.connect(lfoDepth);
    lfoDepth.connect(shG.gain);
    this.engShimmerLfo.start();

    this.engNoise = ctx.createBufferSource();
    this.engNoise.buffer = this.noiseBuf;
    this.engNoise.loop = true;
    const nG = ctx.createGain();
    nG.gain.value = ENGINE.noiseGain;
    this.engNoise.connect(nG);
    nG.connect(this.engFilter);
    this.engNoise.start();

    // Separate wind band that opens with speed — this is what sells velocity.
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windGain.connect(this.master);
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "bandpass";
    this.windFilter.frequency.value = ENGINE.windHz[0];
    this.windFilter.Q.value = 0.7;
    this.windFilter.connect(this.windGain);
    const wSrc = ctx.createBufferSource();
    wSrc.buffer = this.noiseBuf;
    wSrc.loop = true;
    wSrc.connect(this.windFilter);
    wSrc.start();
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }
  dispose(): void {
    try {
      this.engOsc?.stop();
      this.engOsc2?.stop();
      this.engSub?.stop();
      this.engShimmer?.stop();
      this.engShimmerLfo?.stop();
      this.engNoise?.stop();
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.85 : 0, t, 0.05);
  }

  /* ------------------------------- engine bed ----------------------------- */

  /** `speed01` is 0 at the slow end of the run, 1 at terminal velocity. */
  setDrive(speed01: number, alive: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // Every number here is `ENGINE`'s, so `audio.test.ts` is measuring the bed
    // the ship actually makes rather than a second copy of the curve.
    const e = engineAt(speed01, alive);
    this.engGain.gain.setTargetAtTime(e.gain, t, 0.25);
    this.engFilter.frequency.setTargetAtTime(e.cutoff, t, 0.3);
    this.engOsc?.frequency.setTargetAtTime(e.hz, t, 0.4);
    this.engOsc2?.frequency.setTargetAtTime(e.hz, t, 0.4);
    this.engShimmer?.frequency.setTargetAtTime(e.hz * ENGINE.shimmerMul, t, 0.5);
    this.engSub?.frequency.setTargetAtTime(e.subHz, t, 0.4);
    this.windGain.gain.setTargetAtTime(e.windGain, t, 0.3);
    this.windFilter.frequency.setTargetAtTime(e.windHz, t, 0.3);
  }

  setScale(name: ScaleName, bpm: number): void {
    this.scale = name;
    this.bpm = bpm;
  }

  setMusicLayers(n: number): void {
    this.musicLayers = Math.max(0, Math.min(3, n));
  }

  duckMusic(seconds: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(0.06, t + 0.05);
    this.musicBus.gain.setTargetAtTime(0.42, t + seconds, 0.4);
  }

  /* -------------------------------- helpers ------------------------------- */

  private get t(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noise(dur: number, gain: number, type: BiquadFilterType, freq: number, q: number, dest?: AudioNode): { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode } | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.sfxBus);
    const t = this.t;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.start(t);
    src.stop(t + dur + 0.05);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
    return { src, f, g };
  }

  private tone(
    o: {
      type?: OscillatorType;
      freq: number;
      to?: number;
      dur: number;
      gain: number;
      attack?: number;
      detune?: number;
      send?: number;
      dest?: AudioNode;
    },
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = this.t;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    // The shared floor on onset time. Some cues here asked for 0.002 s —
    // 88 samples from silence to peak, which is a step function with a click
    // on it, and the click is most of what a child hears as "too loud".
    const atk = safeAttack(o.attack ?? 0.004);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    if (o.send) {
      const s = ctx.createGain();
      s.gain.value = o.send;
      g.connect(s);
      s.connect(this.delay);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        s.disconnect();
      };
    } else {
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
      };
    }
    osc.start(t);
    osc.stop(t + o.dur + 0.03);
  }

  private degree(i: number, octave = 0): number {
    const sc = SCALES[this.scale];
    const d = sc.degrees[Math.min(sc.degrees.length - 1, Math.max(0, i))];
    return mtof(sc.root + d + octave * 12);
  }

  /* -------------------------------- one-shots ----------------------------- */

  /** The reward. Pitch climbs the scale with the combo, so the combo is audible. */
  gateCorrect(combo: number): void {
    if (!this.ctx) return;
    const step = Math.min(9, combo - 1);
    const f = this.degree(step, 2);
    const jitter = 1 + (Math.random() - 0.5) * 0.012;
    // transient
    this.noise(0.05, 0.32, "highpass", 3200, 0.8);
    // body: a triad struck, slightly detuned for width
    this.tone({ type: "triangle", freq: f * jitter, dur: 0.5, gain: 0.3, send: 0.32 });
    this.tone({ type: "sine", freq: f * 1.4983 * jitter, dur: 0.42, gain: 0.17, send: 0.28 });
    this.tone({ type: "sine", freq: f * 2 * jitter, dur: 0.3, gain: 0.11, send: 0.2 });
    // tail: a soft sub thump so it lands in the body, not just the ears
    this.tone({ type: "sine", freq: 96, to: 62, dur: 0.2, gain: 0.24 });
  }

  /** The cost. Detuned, downward, gritty — unmistakably not the reward sound. */
  gateWrong(): void {
    if (!this.ctx) return;
    this.noise(0.34, 0.34, "lowpass", 1500, 1.1);
    this.tone({ type: "sawtooth", freq: 168, to: 44, dur: 0.44, gain: 0.3 });
    this.tone({ type: "square", freq: 84, to: 31, dur: 0.5, gain: 0.22, detune: -28 });
    this.tone({ type: "sine", freq: 52, to: 34, dur: 0.6, gain: 0.3 });
  }

  /** Near-miss whoosh, doppler-swept. The pitch centre moves with your speed. */
  graze(speed01: number): void {
    const n = this.noise(0.3, 0.2 + speed01 * 0.12, "bandpass", 700 + speed01 * 900, 2.4);
    if (!n || !this.ctx) return;
    const t = this.t;
    n.f.frequency.setValueAtTime(1500 + speed01 * 2200, t);
    n.f.frequency.exponentialRampToValueAtTime(380, t + 0.28);
  }

  spark(index: number): void {
    if (!this.ctx) return;
    const f = this.degree(3 + (index % 7), 3);
    this.tone({ type: "sine", freq: f, dur: 0.14, gain: 0.14, attack: 0.002, send: 0.22 });
    this.tone({ type: "triangle", freq: f * 2, dur: 0.08, gain: 0.06 });
  }

  jump(): void {
    this.tone({ type: "triangle", freq: 260, to: 620, dur: 0.16, gain: 0.15 });
    this.noise(0.1, 0.1, "highpass", 1800, 0.7);
  }

  land(): void {
    this.tone({ type: "sine", freq: 130, to: 68, dur: 0.16, gain: 0.22 });
    this.noise(0.12, 0.16, "lowpass", 900, 0.9);
  }

  slide(): void {
    this.noise(0.42, 0.17, "bandpass", 2400, 1.4);
  }

  hazardHit(): void {
    if (!this.ctx) return;
    this.noise(0.5, 0.42, "lowpass", 900, 0.8);
    this.tone({ type: "square", freq: 128, to: 38, dur: 0.42, gain: 0.3, detune: 22 });
    this.tone({ type: "sine", freq: 60, to: 30, dur: 0.7, gain: 0.34 });
  }

  /** Crossing into a new biome: a riser that resolves into a chord. */
  biomeShift(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 5;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(7000, t + 1.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.24, t + 1.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 1.6);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.value = this.degree(i * 2, 1);
      const gg = ctx.createGain();
      gg.gain.setValueAtTime(0.0001, t + 1.0);
      gg.gain.exponentialRampToValueAtTime(0.13, t + 1.12);
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      osc.connect(gg);
      gg.connect(this.master);
      osc.start(t + 1.0);
      osc.stop(t + 2.7);
      osc.onended = () => {
        osc.disconnect();
        gg.disconnect();
      };
    }
  }

  surgeUp(level: number): void {
    if (!this.ctx) return;
    const f = this.degree(Math.min(8, level), 2);
    this.tone({ type: "sawtooth", freq: f * 0.5, to: f, dur: 0.3, gain: 0.16, send: 0.3 });
    this.tone({ type: "triangle", freq: f * 2, dur: 0.4, gain: 0.13, send: 0.4 });
  }

  lowVoltage(): void {
    this.tone({ type: "sine", freq: 74, to: 58, dur: 0.3, gain: 0.26 });
  }

  reviveCharge(): void {
    if (!this.ctx) return;
    this.tone({ type: "sawtooth", freq: 70, to: 700, dur: 1.1, gain: 0.13, attack: 0.4 });
  }

  reviveSuccess(): void {
    if (!this.ctx) return;
    for (let i = 0; i < 5; i++) {
      const ctx = this.ctx;
      const t = ctx.currentTime + i * 0.055;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = this.degree(i * 2, 2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(g);
      const s = ctx.createGain();
      s.gain.value = 0.4;
      g.connect(s);
      s.connect(this.delay);
      g.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.6);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        s.disconnect();
      };
    }
  }

  runOver(): void {
    if (!this.ctx) return;
    this.tone({ type: "sawtooth", freq: 220, to: 40, dur: 1.5, gain: 0.2 });
    this.tone({ type: "sine", freq: 110, to: 26, dur: 1.9, gain: 0.28 });
    this.noise(1.2, 0.14, "lowpass", 700, 0.6);
  }

  uiTick(): void {
    this.tone({ type: "square", freq: 880, dur: 0.04, gain: 0.06 });
  }

  /* ------------------------------- sequencer ------------------------------ */

  /**
   * Pulled from the render loop rather than a timer: one less thing to leak,
   * and it stops dead when the tab is hidden. 0.14s of lookahead is enough to
   * survive a long frame without audible drift.
   */
  tick(): void {
    const ctx = this.ctx;
    if (!ctx || this.musicLayers === 0) return;
    const spb = 60 / this.bpm / 4; // sixteenths
    while (this.nextNoteTime < ctx.currentTime + 0.14) {
      this.schedule(this.step, this.nextNoteTime);
      this.nextNoteTime += spb;
      this.step = (this.step + 1) % 32;
    }
    if (this.nextNoteTime < ctx.currentTime) this.nextNoteTime = ctx.currentTime + 0.02;
  }

  private schedule(step: number, when: number): void {
    const ctx = this.ctx!;
    const L = this.musicLayers;
    const beat = step % 4 === 0;

    if (beat && (step % 8 === 0 || step % 16 === 12)) this.kick(when);
    if (L >= 1 && step % 4 === 2) this.hat(when, 0.05);
    if (L >= 2 && step % 2 === 1) this.hat(when, 0.028);

    if (L >= 2 && step % 8 === 0) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = this.degree(0, 0) * 0.5;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(1400, when);
      f.frequency.exponentialRampToValueAtTime(220, when + 0.28);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.2, when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
      osc.connect(f);
      f.connect(g);
      g.connect(this.musicBus);
      osc.start(when);
      osc.stop(when + 0.34);
      osc.onended = () => {
        osc.disconnect();
        f.disconnect();
        g.disconnect();
      };
    }

    if (L >= 3 && step % 2 === 0) {
      const idx = [0, 2, 4, 2, 5, 4, 2, 0, 3, 5, 7, 5, 4, 2, 3, 0][(step / 2) % 16];
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = this.degree(idx, 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(0.085, when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
      osc.connect(g);
      g.connect(this.musicBus);
      const s = ctx.createGain();
      s.gain.value = 0.3;
      g.connect(s);
      s.connect(this.delay);
      osc.start(when);
      osc.stop(when + 0.26);
      osc.onended = () => {
        osc.disconnect();
        g.disconnect();
        s.disconnect();
      };
    }
  }

  private kick(when: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.55, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + 0.34);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  private hat(when: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000 + Math.random() * 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    src.start(when);
    src.stop(when + 0.07);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
}
