/**
 * Procedural audio. No files, no assets — every sound is oscillators, noise and
 * envelopes, built the moment it is heard and thrown away.
 *
 * Three layers on every important sound, which is the reason it does not sound
 * like a phone game: a *transient* (a few milliseconds of filtered noise that
 * gives the ear the attack), a *body* (the pitched part that says what
 * happened), and a *tail* (a send into a procedurally generated trench reverb
 * that says where it happened). Pitch moves with the combo up a pentatonic
 * ladder and jitters a few cents each shot, so a thousand shots never fatigue.
 *
 * Nothing here is ever the only carrier of information: every sound has a
 * visual twin, and the whole engine can be muted with no loss of play.
 */

import { createSafetyBus } from "../../../../packs/shared/game-audio/index.ts";

const PENTATONIC = [0, 3, 5, 7, 10];

export type AudioEngine = {
  ready(): boolean;
  resume(): Promise<void>;
  muted(): boolean;
  setMuted(value: boolean): void;
  /** 0..1 — pushes the drone's filter and the ping rate. */
  setIntensity(value: number): void;
  /** Drags the whole bed down under slow motion. */
  setTimeScale(value: number): void;
  shoot(step: number): void;
  /** The gun settling — a tiny tick, the audible half of the sight snapping on. */
  lock(): void;
  hit(): void;
  correct(combo: number): void;
  wrong(): void;
  hostileWake(): void;
  breach(): void;
  bossHit(stage: number): void;
  bossDown(): void;
  focus(on: boolean): void;
  waveClear(combo: number): void;
  gameOver(): void;
  revive(): void;
  tick(dt: number): void;
  dispose(): void;
};

const noteHz = (semitone: number): number => 110 * Math.pow(2, semitone / 12);

export function createAudio(rand: () => number): AudioEngine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let dry: GainNode | null = null;
  let wet: GainNode | null = null;
  let droneGain: GainNode | null = null;
  let droneFilter: BiquadFilterNode | null = null;
  let droneOscs: OscillatorNode[] = [];
  let isMuted = false;
  let intensity = 0;
  let timeScale = 1;
  let pingCooldown = 4;
  let noiseBuffer: AudioBuffer | null = null;

  const now = (): number => (ctx ? ctx.currentTime : 0);

  function build(): void {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    // The last thing between this game and a child's ears. Everything the
    // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
    // going straight to the output. See packs/shared/game-audio/.
    const safety = createSafetyBus(ctx);
    comp.connect(safety.input);

    master = ctx.createGain();
    master.gain.value = isMuted ? 0 : 0.9;
    master.connect(comp);

    dry = ctx.createGain();
    dry.gain.value = 1;
    dry.connect(master);

    // A trench: 2.4 seconds of exponentially decaying noise, darkened towards
    // the tail so the reverb sounds like water rather than a cathedral.
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * 2.4);
    const ir = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const decay = Math.pow(1 - t, 2.6);
        const white = rand() * 2 - 1;
        lp += (white - lp) * (0.5 - 0.42 * t);
        data[i] = lp * decay * (i < rate * 0.01 ? i / (rate * 0.01) : 1);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = ir;
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.5;
    convolver.connect(wetOut);
    wetOut.connect(master);
    wet = ctx.createGain();
    wet.gain.value = 1;
    wet.connect(convolver);

    // Shared noise source buffer (1s of white), sliced by every transient.
    const nb = ctx.createBuffer(1, rate, rate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < rate; i++) nd[i] = rand() * 2 - 1;
    noiseBuffer = nb;

    // The bed: two detuned saws an octave apart under a slow filter sweep.
    droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 240;
    droneFilter.Q.value = 4;
    droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneFilter.connect(droneGain);
    droneGain.connect(dry);
    droneGain.connect(wet);

    for (const [freq, detune, type] of [
      [55, -7, "sawtooth"],
      [55.4, 6, "sawtooth"],
      [110, 0, "triangle"],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      osc.connect(droneFilter);
      osc.start();
      droneOscs.push(osc);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(droneFilter.frequency);
    lfo.start();
    droneOscs.push(lfo);

    droneGain.gain.setTargetAtTime(0.055, ctx.currentTime, 2.5);
  }

  function noise(duration: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1, sendWet = 0.2): void {
    if (!ctx || !noiseBuffer || !dry || !wet) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = 0.8 + rand() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = now();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(dry);
    if (sendWet > 0) {
      const send = ctx.createGain();
      send.gain.value = sendWet;
      g.connect(send);
      send.connect(wet);
    }
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  function tone(
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    gain: number,
    sendWet = 0.2,
    delay = 0,
  ): void {
    if (!ctx || !dry || !wet) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    const t = now() + delay;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + Math.min(0.02, duration * 0.15));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g);
    g.connect(dry);
    if (sendWet > 0) {
      const send = ctx.createGain();
      send.gain.value = sendWet;
      g.connect(send);
      send.connect(wet);
    }
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  const engine: AudioEngine = {
    ready: () => ctx !== null && ctx.state === "running",
    async resume() {
      if (!ctx) build();
      if (ctx && ctx.state !== "running") {
        try {
          await ctx.resume();
        } catch {
          /* a blocked context simply stays silent */
        }
      }
    },
    muted: () => isMuted,
    setMuted(value) {
      isMuted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.9, ctx.currentTime, 0.05);
    },
    setIntensity(value) {
      intensity = Math.max(0, Math.min(1, value));
    },
    setTimeScale(value) {
      timeScale = value;
      if (!ctx || !droneFilter) return;
      for (const osc of droneOscs) osc.detune.setTargetAtTime((value - 1) * 700, ctx.currentTime, 0.12);
    },
    shoot(step) {
      if (!ctx) return;
      const base = noteHz(24 + (PENTATONIC[step % PENTATONIC.length] ?? 0));
      const jitter = 1 + (rand() - 0.5) * 0.03;
      tone("square", base * 2.1 * jitter, base * 0.72, 0.075, 0.055, 0.08);
      noise(0.032, 0.035, "highpass", 2200, 0.8, 0.05);
    },
    lock() {
      tone("sine", 1760, 2200, 0.05, 0.022, 0.15);
      noise(0.02, 0.014, "highpass", 4200, 0.7, 0);
    },
    hit() {
      noise(0.06, 0.06, "bandpass", 1400, 1.4, 0.14);
      tone("triangle", 420, 180, 0.08, 0.05, 0.1);
    },
    correct(combo) {
      const rung = Math.min(combo, 11);
      const octave = Math.floor(rung / PENTATONIC.length);
      const root = noteHz(36 + 12 * octave + (PENTATONIC[rung % PENTATONIC.length] ?? 0));
      // Body: root, fifth, octave — a bell, not a beep.
      tone("sine", root, root, 0.55, 0.1, 0.5);
      tone("sine", root * 1.5, root * 1.5, 0.44, 0.06, 0.5);
      tone("sine", root * 2, root * 2, 0.36, 0.045, 0.5, 0.012);
      tone("triangle", root * 3.02, root * 3, 0.22, 0.02, 0.4, 0.02);
      // Transient + sub.
      noise(0.09, 0.07, "bandpass", 3200, 0.9, 0.3);
      tone("sine", 96, 46, 0.24, 0.22, 0.1);
    },
    wrong() {
      tone("sawtooth", 208, 150, 0.42, 0.075, 0.35);
      tone("sawtooth", 292, 205, 0.42, 0.065, 0.35);
      noise(0.14, 0.11, "lowpass", 900, 1.2, 0.3);
      tone("sine", 120, 40, 0.3, 0.16, 0.1);
    },
    hostileWake() {
      if (!ctx || !dry) return;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 63;
      const growl = ctx.createOscillator();
      growl.type = "sine";
      growl.frequency.value = 7.5;
      const growlGain = ctx.createGain();
      growlGain.gain.value = 14;
      growl.connect(growlGain);
      growlGain.connect(osc.frequency);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 430;
      const g = ctx.createGain();
      const t = now();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.17, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(filter);
      filter.connect(g);
      g.connect(dry);
      if (wet) {
        const send = ctx.createGain();
        send.gain.value = 0.3;
        g.connect(send);
        send.connect(wet);
      }
      osc.start(t);
      growl.start(t);
      osc.stop(t + 1);
      growl.stop(t + 1);
    },
    breach() {
      tone("sine", 130, 32, 0.75, 0.32, 0.25);
      noise(0.4, 0.16, "lowpass", 520, 0.8, 0.5);
      tone("sawtooth", 90, 44, 0.3, 0.09, 0.3);
    },
    bossHit(stage) {
      const root = noteHz(30 + stage * 3);
      tone("sine", 70, 34, 0.5, 0.32, 0.3);
      tone("square", root * 2, root, 0.3, 0.06, 0.5);
      tone("triangle", root * 3.7, root * 2.4, 0.5, 0.045, 0.6);
      noise(0.3, 0.15, "bandpass", 1800, 0.6, 0.6);
    },
    bossDown() {
      for (let i = 0; i < 5; i++) {
        tone("sine", noteHz(48 + (PENTATONIC[i] ?? 0)), noteHz(48 + (PENTATONIC[i] ?? 0)), 0.9, 0.075, 0.7, i * 0.075);
      }
      tone("sine", 90, 28, 1.2, 0.34, 0.4);
      noise(0.9, 0.2, "lowpass", 900, 0.7, 0.8);
    },
    focus(on) {
      if (on) {
        noise(0.7, 0.1, "bandpass", 900, 0.6, 0.6);
        tone("sine", 660, 180, 0.7, 0.07, 0.6);
      } else {
        tone("sine", 180, 700, 0.35, 0.05, 0.4);
      }
    },
    waveClear(combo) {
      const base = 48 + Math.min(12, combo);
      for (let i = 0; i < 3; i++) {
        const hz = noteHz(base + (PENTATONIC[i] ?? 0) + 12);
        tone("triangle", hz, hz, 0.3, 0.04, 0.5, i * 0.055);
      }
    },
    gameOver() {
      tone("sine", 220, 55, 1.5, 0.16, 0.7);
      tone("sawtooth", 110, 41, 1.3, 0.07, 0.6);
      noise(1.1, 0.09, "lowpass", 400, 0.7, 0.8);
    },
    revive() {
      tone("sine", 110, 660, 0.6, 0.12, 0.6);
      for (let i = 0; i < 4; i++) {
        const hz = noteHz(48 + (PENTATONIC[i] ?? 0));
        tone("sine", hz, hz * 2, 0.5, 0.05, 0.6, i * 0.06);
      }
      noise(0.5, 0.1, "highpass", 2000, 0.7, 0.5);
    },
    tick(dt) {
      if (!ctx || !droneGain || !droneFilter) return;
      const t = ctx.currentTime;
      droneFilter.frequency.setTargetAtTime(190 + intensity * 620 * timeScale, t, 0.4);
      droneGain.gain.setTargetAtTime(0.05 + intensity * 0.055, t, 0.6);
      // An occasional sonar ping keeps the bed from sitting still.
      pingCooldown -= dt;
      if (pingCooldown <= 0) {
        pingCooldown = 5.5 + rand() * 7 - intensity * 2.2;
        const hz = noteHz(60 + (PENTATONIC[Math.floor(rand() * PENTATONIC.length)] ?? 0));
        tone("sine", hz, hz, 0.5, 0.03, 0.9);
      }
    },
    dispose() {
      for (const osc of droneOscs) {
        try {
          osc.stop();
        } catch {
          /* already stopped */
        }
      }
      droneOscs = [];
      if (ctx) void ctx.close().catch(() => undefined);
      ctx = null;
      master = dry = wet = droneGain = null;
      droneFilter = null;
      noiseBuffer = null;
    },
  };

  return engine;
}
