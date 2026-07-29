// Procedural Web Audio. No assets, no samples.
//
// Every sound is built from three layers, which is the whole trick to making
// synthesis sound like an object instead of a beep:
//   transient - a few ms of filtered noise: the hammer, the contact, the air
//   body      - pitched partials with an exponential decay: what the thing is
//   tail      - a bandpassed send into a short feedback delay: the room
// Pitch is jittered a few cents every hit, so a child who places two hundred
// weights never hears the same clink twice.
//
// Sound is decorative by contract: nothing in this game is knowable by ear
// alone. Muting removes no information.

import { createSafetyBus } from "../../../packs/shared/game-audio/index.ts";

type Layered = {
  freq: number;
  gain: number;
  decay: number;
  type: OscillatorType;
  detuneCents?: number;
  delaySec?: number;
};

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16]; // semitones over the root

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private roomIn: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private swingGain: GainNode | null = null;
  private enabled = true;
  private lastSolveAt = 0;

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    }
    if (on) void this.ctx?.resume();
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.18;

    const master = ctx.createGain();
    master.gain.value = this.enabled ? 0.9 : 0;
    master.connect(comp);
    // The last thing between this game and a child's ears. Everything the
    // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
    // going straight to the output. See packs/shared/game-audio/.
    const safety = createSafetyBus(ctx);
    comp.connect(safety.input);
    this.master = master;

    // short feedback delay = a small stone room, for tails only
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.085;
    const fb = ctx.createGain();
    fb.gain.value = 0.34;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    const send = ctx.createGain();
    send.gain.value = 1;
    send.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(master);
    this.roomIn = send;

    // noise bed for transients
    const n = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = n.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      d[i] = (seed / 2147483648 - 1) * 0.9;
    }
    this.noise = n;

    // continuous beam-swing air, gain driven per frame
    const swingSrc = ctx.createBufferSource();
    swingSrc.buffer = n;
    swingSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 620;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = 0;
    swingSrc.connect(bp);
    bp.connect(g);
    g.connect(master);
    swingSrc.start();
    this.swingGain = g;

    // room tone: a very quiet low bed so silence is never dead
    const bedSrc = ctx.createBufferSource();
    bedSrc.buffer = n;
    bedSrc.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    const bg = ctx.createGain();
    bg.gain.value = 0.035;
    bedSrc.connect(lp);
    lp.connect(bg);
    bg.connect(master);
    bedSrc.start();
  }

  /** 0..1, how hard the beam is moving. Drives the air over the arm. */
  setSwing(v: number): void {
    if (!this.ctx || !this.swingGain) return;
    const target = Math.min(0.055, Math.max(0, v) * 0.055);
    this.swingGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.06);
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private tone(l: Layered): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = this.now() + (l.delaySec ?? 0);
    const osc = ctx.createOscillator();
    osc.type = l.type;
    osc.frequency.value = l.freq;
    if (l.detuneCents) osc.detune.value = l.detuneCents;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, l.gain), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + l.decay);
    osc.connect(g);
    g.connect(master);
    if (this.roomIn) {
      const s = ctx.createGain();
      s.gain.value = 0.22;
      g.connect(s);
      s.connect(this.roomIn);
    }
    osc.start(t);
    osc.stop(t + l.decay + 0.05);
  }

  private burst(opts: {
    gain: number;
    decay: number;
    freq: number;
    q?: number;
    type?: BiquadFilterType;
    delaySec?: number;
  }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const t = this.now() + (opts.delaySec ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.value = opts.freq;
    f.Q.value = opts.q ?? 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t, Math.random() * 0.4);
    src.stop(t + opts.decay + 0.03);
  }

  private jitter(): number {
    return 1 + (Math.random() - 0.5) * 0.03;
  }

  // ------------------------------------------------------------------ voices

  lift(): void {
    this.burst({ gain: 0.1, decay: 0.09, freq: 1500, q: 0.7 });
    this.tone({ freq: 300 * this.jitter(), gain: 0.05, decay: 0.1, type: "sine" });
  }

  /** Brass on brass. Heavier weights ring lower and longer. */
  clink(weight: number): void {
    const heaviness = Math.min(1, Math.abs(weight) / 14);
    const base = 880 - heaviness * 420;
    this.burst({ gain: 0.16, decay: 0.05, freq: 3200 - heaviness * 900, q: 0.8 });
    this.tone({
      freq: base * this.jitter(),
      gain: 0.16,
      decay: 0.26 + heaviness * 0.3,
      type: "triangle",
    });
    this.tone({
      freq: base * 2.76 * this.jitter(), // inharmonic partial: metal, not marimba
      gain: 0.06,
      decay: 0.18,
      type: "sine",
    });
    this.tone({ freq: 120 + heaviness * 40, gain: 0.1, decay: 0.12, type: "sine" });
  }

  /** The beam meeting its stop. */
  clank(force: number): void {
    const f = Math.min(1, force);
    this.burst({ gain: 0.12 + f * 0.2, decay: 0.06, freq: 1800, q: 0.6 });
    this.tone({ freq: 96 * this.jitter(), gain: 0.2 + f * 0.2, decay: 0.24, type: "sine" });
    this.tone({ freq: 214 * this.jitter(), gain: 0.08, decay: 0.5, type: "triangle" });
    this.chain(2 + Math.round(f * 3));
  }

  chain(n = 3): void {
    for (let i = 0; i < n; i++) {
      this.burst({
        gain: 0.05,
        decay: 0.04,
        freq: 2400 + Math.random() * 2200,
        q: 3,
        delaySec: i * (0.02 + Math.random() * 0.03),
      });
    }
  }

  /** The safety pin drawing out of the beam. Anticipation, in one sound. */
  pin(): void {
    this.burst({ gain: 0.14, decay: 0.05, freq: 2600, q: 4 });
    this.tone({ freq: 520, gain: 0.07, decay: 0.09, type: "square" });
    this.tone({ freq: 1180, gain: 0.04, decay: 0.16, type: "sine", delaySec: 0.05 });
  }

  /** Wrong value: dull, low, short. Deliberately less interesting than being right. */
  reject(): void {
    this.burst({ gain: 0.1, decay: 0.07, freq: 420, q: 0.7, type: "lowpass" });
    this.tone({ freq: 132 * this.jitter(), gain: 0.16, decay: 0.19, type: "triangle" });
    this.tone({ freq: 99 * this.jitter(), gain: 0.1, decay: 0.28, type: "sine" });
  }

  /** The bell. This is the sound the whole game is for. */
  solve(step: number): void {
    const t = this.now();
    if (t - this.lastSolveAt < 0.25) return;
    this.lastSolveAt = t;
    const root = 392 * Math.pow(2, (PENTATONIC[step % PENTATONIC.length] % 12) / 12);
    const partials = [1, 1.5, 2, 3, 4.02, 5.4];
    const gains = [0.2, 0.15, 0.13, 0.07, 0.045, 0.03];
    for (let i = 0; i < partials.length; i++) {
      this.tone({
        freq: root * partials[i] * this.jitter(),
        gain: gains[i],
        decay: 1.5 - i * 0.14,
        type: i < 3 ? "sine" : "triangle",
        delaySec: i * 0.012,
      });
    }
    this.tone({ freq: 66, gain: 0.24, decay: 0.5, type: "sine" });
    this.burst({ gain: 0.1, decay: 0.5, freq: 5200, q: 0.5 });
    this.chain(3);
  }

  /** A ring of the orrery catching light. */
  tick(step: number): void {
    const root = 1046 * Math.pow(2, (PENTATONIC[step % PENTATONIC.length] % 12) / 12);
    this.tone({ freq: root * this.jitter(), gain: 0.09, decay: 0.5, type: "sine" });
    this.tone({ freq: root * 2.01, gain: 0.03, decay: 0.3, type: "sine" });
  }

  /** End of a movement: the apparatus reconfiguring itself. */
  fanfare(): void {
    const root = 262;
    const chord = [1, 1.5, 2, 2.5, 3, 4];
    chord.forEach((m, i) => {
      this.tone({
        freq: root * m * this.jitter(),
        gain: 0.14 - i * 0.014,
        decay: 1.9 - i * 0.12,
        type: i % 2 === 0 ? "sine" : "triangle",
        delaySec: i * 0.075,
      });
    });
    this.tone({ freq: 55, gain: 0.26, decay: 1.1, type: "sine" });
    for (let i = 0; i < 4; i++) {
      this.burst({ gain: 0.07, decay: 0.4, freq: 3000 + i * 900, q: 0.6, delaySec: 0.09 * i });
    }
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.swingGain = null;
  }
}
