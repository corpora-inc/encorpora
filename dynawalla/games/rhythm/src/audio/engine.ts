/**
 * Splitbeat audio. Everything is synthesised at runtime — there is not one
 * sample file in this package.
 *
 * Structure, and why:
 *  - `AudioContext.currentTime` is the ONLY musical clock. requestAnimationFrame
 *    is for pixels. Notes are scheduled ahead with `start(when)`; the renderer
 *    reads the same clock and derives pixel positions from it, so picture and
 *    sound cannot drift apart even when a frame is dropped.
 *  - Every voice is transient + body + tail. A drum with no transient reads as
 *    mush on a tablet speaker; a drum with no tail reads as a click.
 *  - Every voice takes a `tune` and a `gain` jitter so the hundredth kick is not
 *    bit-identical to the first. Sample-identical repetition is what makes a
 *    rhythm game's audio fatiguing after four minutes.
 */

import { createSafetyBus } from "../../../../packs/shared/game-audio/index.ts";

export type Bus = "drums" | "music" | "sfx";

const A4 = 440;
export const midiToHz = (m: number): number => A4 * Math.pow(2, (m - 69) / 12);

/** exponentialRamp cannot reach zero; this is the floor everything decays to. */
const EPS = 0.0001;

function tanhCurve(amount: number, n = 1024): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return c;
}

export class AudioEngine {
  readonly ctx: AudioContext;

  private master: GainNode;
  private masterFilter: BiquadFilterNode;
  private limiter: DynamicsCompressorNode;
  readonly analyser: AnalyserNode;

  private drums: GainNode;
  private drumDrive: WaveShaperNode;
  private music: GainNode;
  private sfx: GainNode;

  private verb: ConvolverNode;
  private verbGain: GainNode;
  private delay: DelayNode;
  private delayFb: GainNode;
  private delayGain: GainNode;

  private noise: AudioBuffer;
  private rngState = 0x9e3779b9;

  /** live spectrum + waveform, read once per frame by the renderer */
  readonly freq: Uint8Array<ArrayBuffer>;
  readonly wave: Uint8Array<ArrayBuffer>;

  private _muted = false;
  private disposed = false;

  constructor() {
    const Ctor: typeof AudioContext =
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      window.AudioContext;
    // `interactive` keeps output latency low, which matters more here than
    // buffer safety — this is a timing game.
    this.ctx = new Ctor({ latencyHint: "interactive" });
    const ctx = this.ctx;

    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.16;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.72;
    this.analyser.minDecibels = -84;
    this.analyser.maxDecibels = -12;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.wave = new Uint8Array(this.analyser.fftSize);

    this.master = ctx.createGain();
    // 0.65, not 0.9. `snare()` rendered at 1.011 and `impact()` at 1.020 —
    // above full scale on one hit, before a bar of them overlapped.
    this.master.gain.value = 0.65;

    this.masterFilter = ctx.createBiquadFilter();
    this.masterFilter.type = "lowpass";
    this.masterFilter.frequency.value = 20000;
    this.masterFilter.Q.value = 0.6;

    this.masterFilter.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(this.analyser);
    // The last thing between this game and a child's ears. Everything the
    // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
    // going straight to the output. See packs/shared/game-audio/.
    const safety = createSafetyBus(ctx);
    this.analyser.connect(safety.input);

    this.drums = ctx.createGain();
    this.drums.gain.value = 1.0;
    this.drumDrive = ctx.createWaveShaper();
    this.drumDrive.curve = tanhCurve(1.9);
    this.drumDrive.oversample = "2x";
    this.drums.connect(this.drumDrive);
    this.drumDrive.connect(this.masterFilter);

    this.music = ctx.createGain();
    this.music.gain.value = 0.62;
    this.music.connect(this.masterFilter);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.85;
    this.sfx.connect(this.masterFilter);

    // --- procedural plate: noise burst with an exponential tail ------------
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeImpulse(1.9, 2.6);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.34;
    this.verb.connect(this.verbGain);
    this.verbGain.connect(this.masterFilter);

    // --- dotted-eighth feedback delay -------------------------------------
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.34;
    this.delayFb = ctx.createGain();
    this.delayFb.gain.value = 0.36;
    const dlpf = ctx.createBiquadFilter();
    dlpf.type = "lowpass";
    dlpf.frequency.value = 2600;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.5;
    this.delay.connect(dlpf);
    dlpf.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    dlpf.connect(this.delayGain);
    this.delayGain.connect(this.masterFilter);

    this.noise = this.makeNoise(2.5);
  }

  /* ---------------------------------------------------------------- */
  /* infrastructure                                                    */
  /* ---------------------------------------------------------------- */

  get now(): number {
    return this.ctx.currentTime;
  }

  /** Round-trip output latency, used to align visuals with what is heard. */
  get outputLatency(): number {
    const c = this.ctx as AudioContext & { outputLatency?: number; baseLatency?: number };
    const out = typeof c.outputLatency === "number" && isFinite(c.outputLatency) ? c.outputLatency : 0;
    const base = typeof c.baseLatency === "number" && isFinite(c.baseLatency) ? c.baseLatency : 0;
    return out || base || 0;
  }

  async resume(): Promise<void> {
    if (this.disposed) return;
    if (this.ctx.state !== "running") {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn("[splitbeat] AudioContext.resume failed", err);
      }
    }
  }

  setMuted(m: boolean): void {
    this._muted = m;
    this.master.gain.cancelScheduledValues(this.now);
    this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.now, 0.02);
  }
  get muted(): boolean {
    return this._muted;
  }

  /** Musical duck: the whole mix goes underwater for `dur` seconds. */
  muffle(dur: number, toHz = 420): void {
    const t = this.now;
    const f = this.masterFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(f.value, 800), t);
    f.exponentialRampToValueAtTime(toHz, t + 0.05);
    f.exponentialRampToValueAtTime(20000, t + dur);
  }

  /** Tape stop: pitch and brightness collapse together. */
  tapeStop(dur = 0.85): void {
    const t = this.now;
    const f = this.masterFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(20000, t);
    f.exponentialRampToValueAtTime(180, t + dur);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(28, t + dur);
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.03);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Bring the mix back up instantly (used on revive). */
  clearFilter(ramp = 0.25): void {
    const t = this.now;
    const f = this.masterFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(Math.max(120, f.value), t);
    f.exponentialRampToValueAtTime(20000, t + ramp);
  }

  setDelayTime(seconds: number): void {
    this.delay.delayTime.setTargetAtTime(Math.max(0.02, Math.min(1.4, seconds)), this.now, 0.08);
  }

  /** Music-layer level, so combo can literally open the arrangement up. */
  setMusicGain(v: number, ramp = 0.4): void {
    this.music.gain.setTargetAtTime(v, this.now, ramp);
  }

  pollSpectrum(): void {
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.wave);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.master.disconnect();
      this.analyser.disconnect();
      void this.ctx.close();
    } catch (err) {
      console.warn("[splitbeat] audio dispose failed", err);
    }
  }

  /* ---------------------------------------------------------------- */
  /* buffers                                                           */
  /* ---------------------------------------------------------------- */

  /** Deterministic noise — same texture every session, no Math.random drift. */
  private rand(): number {
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return (this.rngState / 4294967296) * 2 - 1;
  }

  private makeNoise(seconds: number): AudioBuffer {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = this.rand();
    return buf;
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, n, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        // a touch of early-reflection sparsity keeps it from sounding like a
        // plain noise swell
        const sparse = i < rate * 0.012 ? 0.25 : 1;
        d[i] = this.rand() * Math.pow(1 - t, decay) * sparse;
      }
    }
    return buf;
  }

  private bus(b: Bus): GainNode {
    return b === "drums" ? this.drums : b === "music" ? this.music : this.sfx;
  }

  private src(t: number, dur: number, offset = -1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const off = offset >= 0 ? offset : Math.abs(this.rand()) * (this.noise.duration - dur - 0.01);
    s.start(t, off, dur + 0.02);
    s.stop(t + dur + 0.02);
    return s;
  }

  private send(node: AudioNode, verb: number, delay: number): void {
    if (verb > 0) {
      const g = this.ctx.createGain();
      g.gain.value = verb;
      node.connect(g);
      g.connect(this.verb);
    }
    if (delay > 0) {
      const g = this.ctx.createGain();
      g.gain.value = delay;
      node.connect(g);
      g.connect(this.delay);
    }
  }

  /* ---------------------------------------------------------------- */
  /* voices                                                            */
  /* ---------------------------------------------------------------- */

  kick(t: number, gain = 1, tune = 1): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = "sine";
    const f0 = 168 * tune * (1 + this.rand() * 0.02);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(44 * tune, t + 0.075);
    const peak = 0.95 * gain;
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.34);
    o.connect(g);
    g.connect(this.bus("drums"));
    o.start(t);
    o.stop(t + 0.4);

    // transient: a short highpassed tick so it cuts through a tablet speaker
    const cg = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1100;
    cg.gain.setValueAtTime(0.5 * gain, t);
    cg.gain.exponentialRampToValueAtTime(EPS, t + 0.022);
    const s = this.src(t, 0.03);
    s.connect(hp);
    hp.connect(cg);
    cg.connect(this.bus("drums"));
    this.send(g, 0.05, 0);
  }

  snare(t: number, gain = 1, tune = 1): void {
    const ctx = this.ctx;
    // body
    const bo = ctx.createOscillator();
    const bg = ctx.createGain();
    bo.type = "triangle";
    bo.frequency.setValueAtTime(196 * tune * (1 + this.rand() * 0.03), t);
    bo.frequency.exponentialRampToValueAtTime(148 * tune, t + 0.09);
    bg.gain.setValueAtTime(EPS, t);
    bg.gain.exponentialRampToValueAtTime(0.42 * gain, t + 0.003);
    bg.gain.exponentialRampToValueAtTime(EPS, t + 0.13);
    bo.connect(bg);
    bg.connect(this.bus("drums"));
    bo.start(t);
    bo.stop(t + 0.18);

    // rattle
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1750 * tune * (1 + this.rand() * 0.06);
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(EPS, t);
    ng.gain.exponentialRampToValueAtTime(0.62 * gain, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(EPS, t + 0.19);
    const s = this.src(t, 0.22);
    s.connect(bp);
    bp.connect(ng);
    ng.connect(this.bus("drums"));
    this.send(ng, 0.3, 0);
  }

  hat(t: number, gain = 1, open = false): void {
    const ctx = this.ctx;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7400 * (1 + this.rand() * 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 10800;
    bp.Q.value = 0.5;
    const dur = open ? 0.26 : 0.052;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime((open ? 0.3 : 0.42) * gain, t + 0.001);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    const s = this.src(t, dur + 0.02);
    s.connect(hp);
    hp.connect(bp);
    bp.connect(g);
    g.connect(this.bus("drums"));
    this.send(g, open ? 0.24 : 0.1, 0.12);
  }

  /** Two-operator FM bell — the "reward" timbre. */
  bell(t: number, midi: number, gain = 1, decay = 0.55, verb = 0.5): void {
    const ctx = this.ctx;
    const f = midiToHz(midi);
    const car = ctx.createOscillator();
    car.type = "sine";
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = f * 2.01;
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(f * 3.4, t);
    modG.gain.exponentialRampToValueAtTime(f * 0.05, t + decay * 0.6);
    mod.connect(modG);
    modG.connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.3 * gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(EPS, t + decay);
    car.connect(g);
    g.connect(this.bus("music"));
    this.send(g, verb, 0.3);
    mod.start(t);
    car.start(t);
    mod.stop(t + decay + 0.05);
    car.stop(t + decay + 0.05);
  }

  bass(t: number, dur: number, midi: number, gain = 1): void {
    const ctx = this.ctx;
    const f = midiToHz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(Math.min(180 + f * 2, 900), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(90, f * 1.4), t + Math.min(0.3, dur));
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.5 * gain, t + 0.012);
    g.gain.setTargetAtTime(0.34 * gain, t + 0.05, 0.2);
    g.gain.setValueAtTime(0.34 * gain, t + dur * 0.86);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    const saw = ctx.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = f;
    saw.detune.value = this.rand() * 5;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = f / 2;
    const subG = ctx.createGain();
    subG.gain.value = 0.7;
    saw.connect(lp);
    sub.connect(subG);
    subG.connect(lp);
    lp.connect(g);
    g.connect(this.bus("music"));
    saw.start(t);
    sub.start(t);
    saw.stop(t + dur + 0.06);
    sub.stop(t + dur + 0.06);
  }

  pad(t: number, dur: number, midis: readonly number[], gain = 1): void {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(2100, t + dur * 0.45);
    lp.frequency.linearRampToValueAtTime(700, t + dur);
    lp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(0.085 * gain, t + dur * 0.3);
    g.gain.setValueAtTime(0.085 * gain, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    lp.connect(g);
    g.connect(this.bus("music"));
    this.send(g, 0.55, 0);
    for (const m of midis) {
      const f = midiToHz(m);
      for (let k = 0; k < 2; k++) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = (k === 0 ? -7 : 7) + this.rand() * 4;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  }

  arp(t: number, midi: number, gain = 1): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = midiToHz(midi);
    o.detune.value = this.rand() * 6;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2800;
    lp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.1 * gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.2);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.bus("music"));
    this.send(g, 0.2, 0.5);
    o.start(t);
    o.stop(t + 0.26);
  }

  lead(t: number, dur: number, midi: number, gain = 1): void {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.13 * gain, t + 0.02);
    g.gain.setValueAtTime(0.13 * gain, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4200;
    const vib = ctx.createOscillator();
    vib.type = "sine";
    vib.frequency.value = 5.2;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(5, t + dur * 0.5);
    vib.connect(vibG);
    for (const [type, det, lvl] of [
      ["triangle", 0, 1],
      ["sawtooth", 6, 0.34],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiToHz(midi);
      o.detune.value = det;
      vibG.connect(o.detune);
      const og = ctx.createGain();
      og.gain.value = lvl;
      o.connect(og);
      og.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.08);
    }
    lp.connect(g);
    g.connect(this.bus("music"));
    this.send(g, 0.4, 0.35);
    vib.start(t);
    vib.stop(t + dur + 0.08);
  }

  /* --- non-musical feedback ---------------------------------------- */

  /** Rising tension for a gate approach. */
  riser(t: number, dur: number, gain = 1): void {
    const ctx = this.ctx;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 3.5;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(7200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(0.3 * gain, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    const s = this.src(t, dur + 0.05);
    s.connect(bp);
    bp.connect(g);
    g.connect(this.bus("sfx"));
    this.send(g, 0.4, 0);
  }

  /** Big low impact — damage, breakdown, sector change. */
  impact(t: number, gain = 1): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(26, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.85 * gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.6);
    o.connect(g);
    g.connect(this.bus("sfx"));
    o.start(t);
    o.stop(t + 0.65);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(2400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.35);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.5 * gain, t);
    ng.gain.exponentialRampToValueAtTime(EPS, t + 0.4);
    const s = this.src(t, 0.42);
    s.connect(lp);
    lp.connect(ng);
    ng.connect(this.bus("sfx"));
    this.send(ng, 0.5, 0);
  }

  /** Glass: a scatter of short bandpassed bursts at unrelated pitches. */
  shatter(t: number, gain = 1, count = 9): void {
    for (let i = 0; i < count; i++) {
      const dt = t + i * (0.008 + Math.abs(this.rand()) * 0.02);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1800 + Math.abs(this.rand()) * 7000;
      bp.Q.value = 9 + Math.abs(this.rand()) * 14;
      const g = this.ctx.createGain();
      const lvl = (0.16 + Math.abs(this.rand()) * 0.14) * gain;
      g.gain.setValueAtTime(lvl, dt);
      g.gain.exponentialRampToValueAtTime(EPS, dt + 0.12 + Math.abs(this.rand()) * 0.2);
      const s = this.src(dt, 0.34);
      s.connect(bp);
      bp.connect(g);
      g.connect(this.bus("sfx"));
      this.send(g, 0.55, 0.2);
    }
  }

  /** A missed note: the hole where a drum should have been. */
  thud(t: number, gain = 1): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4 * gain, t);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.14);
    const s = this.src(t, 0.16);
    s.connect(lp);
    lp.connect(g);
    g.connect(this.bus("sfx"));
  }

  /** A tap that hit nothing. Quiet, dry, and clearly "not a note". */
  tick(t: number, gain = 1): void {
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07 * gain, t);
    g.gain.exponentialRampToValueAtTime(EPS, t + 0.035);
    const s = this.src(t, 0.05);
    s.connect(hp);
    hp.connect(g);
    g.connect(this.bus("sfx"));
  }

  /** Upward chirp for a correct gate; downward for a wrong one. */
  chirp(t: number, from: number, to: number, dur = 0.22, gain = 1): void {
    const o = this.ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(EPS, t);
    g.gain.exponentialRampToValueAtTime(0.22 * gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(EPS, t + dur);
    o.connect(g);
    g.connect(this.bus("sfx"));
    this.send(g, 0.3, 0.2);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
}
