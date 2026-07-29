/**
 * Procedural WebAudio. No assets, no samples.
 *
 * Every voice is transient + body + tail with a randomised pitch so a
 * twenty-minute run never fatigues. Sound is disableable and never carries
 * information alone — every audio cue has a visual twin.
 *
 * The most important voice here is `perfect()`: a pentatonic ladder that climbs
 * one step per consecutive true placement and resets on a mistake. That single
 * rising line is what makes a stacker compulsive; everything else is dressing.
 */

import { createSafetyBus } from "../../../../packs/shared/game-audio/index.ts";

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34, 36];

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;
  private started = false;

  /**
   * Build the graph at MOUNT, not on the first tap.
   *
   * Measured: constructing the context and generating the impulse response
   * inside the first pointerdown cost 206ms — a fifth of a second of dead air
   * on the very first thing a child does. An AudioContext may be constructed
   * without a gesture; it simply starts suspended, and `resume()` inside the
   * gesture is all the autoplay policy actually wants.
   */
  start(): void {
    if (this.started) return;
    const Ctor: typeof AudioContext | undefined =
      typeof AudioContext !== "undefined"
        ? AudioContext
        : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      const ctx = new Ctor();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -13;
      comp.knee.value = 26;
      comp.ratio.value = 7;
      comp.attack.value = 0.003;
      comp.release.value = 0.22;
      const master = ctx.createGain();
      // 0.65, not 0.9. `shatter()` rendered at 1.034 with 2 clipped samples on
      // a single hit; six reached 2.148 with 594.
      master.gain.value = 0.65;
      master.connect(comp);
      // The last thing between this game and a child's ears. Everything the
      // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
      // going straight to the output. See packs/shared/game-audio/.
      const safety = createSafetyBus(ctx);
      comp.connect(safety.input);
      this.master = master;

      // A short procedural room. Cheap, generated once, and the difference
      // between "beeps" and "a place".
      const len = Math.floor(ctx.sampleRate * 0.85);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.1) * (i < 40 ? i / 40 : 1);
        }
      }
      const conv = ctx.createConvolver();
      conv.buffer = ir;
      const wet = ctx.createGain();
      wet.gain.value = 0.24;
      wet.connect(conv);
      conv.connect(master);
      this.wet = wet;

      const nlen = Math.floor(ctx.sampleRate * 2);
      const nb = ctx.createBuffer(1, nlen, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = nb;

      this.started = true;
    } catch (err) {
      console.warn("[stack] audio unavailable", err);
      this.ctx = null;
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  dispose(): void {
    try {
      void this.ctx?.close();
    } catch (err) {
      console.warn("[stack] audio close failed", err);
    }
    this.ctx = null;
    this.started = false;
  }

  private get t(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private env(g: GainNode, t0: number, peak: number, a: number, d: number, send = 0.35): void {
    const p = g.gain;
    p.setValueAtTime(0.0001, t0);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    p.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    if (this.master) g.connect(this.master);
    if (this.wet && send > 0) {
      const s = this.ctx!.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.wet);
    }
  }

  private osc(
    type: OscillatorType,
    f0: number,
    f1: number,
    t0: number,
    dur: number,
    peak: number,
    a = 0.004,
    send = 0.3,
    detune = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, peak, a, dur, send);
    o.connect(g);
    o.start(t0);
    o.stop(t0 + dur + 0.06);
  }

  private burst(
    t0: number,
    dur: number,
    peak: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    send = 0.3,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = ctx.createGain();
    this.env(g, t0, peak, 0.002, dur, send);
    s.connect(bq);
    bq.connect(g);
    s.start(t0, Math.random() * 1.2);
    s.stop(t0 + dur + 0.05);
  }

  private go(): boolean {
    return this.enabled && this.ctx !== null;
  }

  /* ── voices ───────────────────────────────────────────────────────────── */

  /** Turnaround: the metronome the whole game breathes to. */
  tick(slot: number): void {
    if (!this.go()) return;
    const t = this.t;
    const f = 1180 + slot * 130 + Math.random() * 60;
    this.osc("triangle", f, f * 0.86, t, 0.045, 0.055, 0.001, 0.12);
    this.burst(t, 0.02, 0.03, "highpass", 2600, 2600, 0.7, 0.08);
  }

  /** The tap. Anticipation — the wind-up before the slam. */
  release(): void {
    if (!this.go()) return;
    const t = this.t;
    this.burst(t, 0.075, 0.09, "bandpass", 2200, 620, 1.2, 0.14);
  }

  /** Landing. `peril` 0→1 thins the body so a thin tower sounds thin. */
  thunk(peril: number, floor: number): void {
    if (!this.go()) return;
    const t = this.t;
    const v = 1 + (Math.random() - 0.5) * 0.09;
    const body = (78 - peril * 26) * v * (1 + Math.min(0.35, floor * 0.002));
    this.osc("sine", body * 1.9, body * 0.62, t, 0.19, 0.5, 0.002, 0.3);
    this.osc("triangle", body * 3.1, body * 1.4, t, 0.1, 0.16, 0.001, 0.22);
    this.burst(t, 0.075, 0.32 - peril * 0.1, "lowpass", 2400 * v, 380, 0.9, 0.28);
  }

  /** The ladder. Index = consecutive perfects. This is the hook. */
  perfect(combo: number): void {
    if (!this.go()) return;
    const t = this.t;
    const step = PENTA[Math.min(PENTA.length - 1, combo)] ?? 0;
    const f = 261.63 * Math.pow(2, step / 12) * (1 + (Math.random() - 0.5) * 0.004);
    const send = 0.42;
    this.osc("sine", f, f, t, 0.5, 0.3, 0.004, send);
    this.osc("sine", f * 2, f * 2, t, 0.34, 0.11, 0.003, send, 4);
    this.osc("triangle", f * 3.01, f * 3.01, t, 0.2, 0.06, 0.002, send);
    // A crisp strike so it reads at the top of the mix.
    this.burst(t, 0.035, 0.11, "bandpass", f * 6, f * 3, 3.5, 0.2);
    // The tower breathing back out.
    this.osc("sine", f * 0.5, f * 0.505, t + 0.02, 0.6, 0.09, 0.02, 0.5);
  }

  /** Wrong value: the slab cracks. */
  crack(): void {
    if (!this.go()) return;
    const t = this.t;
    const v = 1 + (Math.random() - 0.5) * 0.14;
    this.osc("sawtooth", 190 * v, 62 * v, t, 0.2, 0.22, 0.001, 0.28);
    this.osc("sawtooth", 197 * v, 64 * v, t, 0.2, 0.18, 0.001, 0.28);
    this.burst(t, 0.15, 0.42, "bandpass", 1700 * v, 260, 1.5, 0.4);
    this.osc("sine", 58, 34, t, 0.38, 0.4, 0.003, 0.24);
  }

  /** Total miss: the slab is gone and the tower is bitten. */
  shatter(): void {
    if (!this.go()) return;
    const t = this.t;
    this.burst(t, 0.42, 0.5, "bandpass", 3800, 190, 0.9, 0.55);
    this.burst(t, 0.24, 0.34, "highpass", 5200, 1400, 0.6, 0.4);
    this.osc("sine", 92, 26, t, 0.6, 0.5, 0.003, 0.3);
    this.osc("sawtooth", 120, 31, t, 0.35, 0.14, 0.002, 0.3);
  }

  /** A new band of sky. Slow, wide, worth chasing. */
  stratum(index: number): void {
    if (!this.go()) return;
    const t = this.t;
    const root = 130.81 * Math.pow(2, (index % 6) / 12);
    for (const [i, mul] of [1, 1.5, 2, 3, 4].entries()) {
      this.osc("sine", root * mul, root * mul * 1.002, t + i * 0.012, 1.5 - i * 0.13, 0.16 / (1 + i * 0.55), 0.13, 0.6);
    }
    // Riser into it.
    this.burst(t - 0.0, 0.5, 0.16, "bandpass", 300, 5200, 1.1, 0.5);
  }

  /** The width growing back — a small upward glide under the ladder note. */
  grow(): void {
    if (!this.go()) return;
    const t = this.t;
    this.osc("sine", 320, 640, t, 0.24, 0.08, 0.01, 0.35);
  }

  collapse(): void {
    if (!this.go()) return;
    const t = this.t;
    this.osc("sawtooth", 150, 24, t, 1.9, 0.42, 0.01, 0.55);
    this.osc("sine", 88, 18, t, 2.2, 0.5, 0.02, 0.5);
    this.burst(t, 1.7, 0.4, "lowpass", 2600, 120, 0.7, 0.6);
    for (let i = 0; i < 7; i++) {
      this.burst(t + 0.05 + i * 0.11 + Math.random() * 0.06, 0.16, 0.16, "bandpass", 900 + Math.random() * 1800, 220, 1.4, 0.5);
    }
  }

  revive(ok: boolean): void {
    if (!this.go()) return;
    const t = this.t;
    if (!ok) {
      this.osc("sawtooth", 160, 70, t, 0.5, 0.24, 0.004, 0.3);
      this.burst(t, 0.3, 0.2, "lowpass", 1400, 200, 0.8, 0.3);
      return;
    }
    for (let i = 0; i < 5; i++) {
      const f = 261.63 * Math.pow(2, (PENTA[i] ?? 0) / 12);
      this.osc("sine", f, f, t + i * 0.055, 0.45, 0.2, 0.005, 0.5);
    }
  }

  /** A single low pulse under the pointer-down so the tap is never silent. */
  uiTap(): void {
    if (!this.go()) return;
    this.osc("sine", 420, 300, this.t, 0.07, 0.09, 0.002, 0.15);
  }
}
