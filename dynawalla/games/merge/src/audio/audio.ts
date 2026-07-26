/**
 * Procedural audio. No assets, no samples, nothing to download.
 *
 * Every sound is built from three layers, which is what stops synthesised SFX
 * sounding like a 1980s calculator:
 *   transient — a few ms of filtered noise, the "click" your ear localises
 *   body      — the pitched part that says what happened
 *   tail      — a decaying resonance that gives the room a size
 *
 * Everything is detuned by a small random amount on every trigger, so a
 * twenty-chain never turns into a machine gun of identical clicks.
 *
 * Audio is decorative by construction: nothing here is the only channel for any
 * piece of information, and the whole kit can be switched off.
 */

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

export class AudioKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  enabled = true;
  private failed = false;

  /** Must be called from a user gesture on iOS. Safe to call repeatedly. */
  resume(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        this.ctx = new Ctor();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.knee.value = 18;
        comp.ratio.value = 9;
        comp.attack.value = 0.003;
        comp.release.value = 0.14;
        const g = this.ctx.createGain();
        g.gain.value = 0.62;
        g.connect(comp);
        comp.connect(this.ctx.destination);
        this.master = g;

        const len = Math.floor(this.ctx.sampleRate * 1.2);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < len; i++) {
          s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
          d[i] = (s / 0xffffffff) * 2 - 1;
        }
        this.noise = buf;
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.failed = true;
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on) this.resume();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? 0.62 : 0, this.ctx.currentTime, 0.02);
    }
  }

  private get t(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private ok(): boolean {
    return this.enabled && !!this.ctx && !!this.master && this.ctx.state === "running";
  }

  private jitter(cents = 30): number {
    return 2 ** ((Math.random() * 2 - 1) * (cents / 1200));
  }

  private env(gain: GainNode, t0: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  /** transient: a short burst of filtered noise */
  private hit(t0: number, gain: number, hz: number, q: number, decay: number, type: BiquadFilterType = "bandpass"): void {
    if (!this.ctx || !this.master || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, t0, gain, 0.002, decay);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + decay + 0.06);
  }

  /** body: a pitched oscillator with an optional glide */
  private tone(
    t0: number,
    hz: number,
    to: number,
    gain: number,
    decay: number,
    type: OscillatorType = "sine",
    attack = 0.004,
  ): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const j = this.jitter();
    o.frequency.setValueAtTime(hz * j, t0);
    if (to !== hz) o.frequency.exponentialRampToValueAtTime(Math.max(20, to * j), t0 + decay);
    const g = this.ctx.createGain();
    this.env(g, t0, gain, attack, decay);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + decay + 0.08);
  }

  /** an FM bell — carrier plus a modulator at a non-integer ratio */
  private bell(t0: number, hz: number, gain: number, decay: number, ratio = 2.41, index = 320): void {
    if (!this.ctx || !this.master) return;
    const j = this.jitter(18);
    const car = this.ctx.createOscillator();
    car.frequency.value = hz * j;
    const mod = this.ctx.createOscillator();
    mod.frequency.value = hz * ratio * j;
    const modGain = this.ctx.createGain();
    modGain.gain.setValueAtTime(index, t0);
    modGain.gain.exponentialRampToValueAtTime(1, t0 + decay * 0.7);
    const g = this.ctx.createGain();
    this.env(g, t0, gain, 0.003, decay);
    mod.connect(modGain);
    modGain.connect(car.frequency);
    car.connect(g);
    g.connect(this.master);
    mod.start(t0);
    car.start(t0);
    mod.stop(t0 + decay + 0.1);
    car.stop(t0 + decay + 0.1);
  }

  /* ---------------- the kit ---------------- */

  move(): void {
    if (!this.ok()) return;
    this.hit(this.t, 0.05, 2600 + Math.random() * 900, 3, 0.03, "highpass");
  }

  hold(): void {
    if (!this.ok()) return;
    this.tone(this.t, 420, 520, 0.05, 0.07, "triangle");
  }

  /** hardness 0..1 — how far the chip fell */
  land(hardness: number): void {
    if (!this.ok()) return;
    const t0 = this.t;
    const h = Math.max(0, Math.min(1, hardness));
    this.hit(t0, 0.16 + h * 0.2, 1400 - h * 500, 1.1, 0.05 + h * 0.04);
    this.tone(t0, 150 + h * 60, 52, 0.34 + h * 0.2, 0.14 + h * 0.06, "sine");
    this.tone(t0 + 0.005, 92, 46, 0.2, 0.2, "triangle");
    this.hit(t0 + 0.01, 0.05 + h * 0.05, 320, 0.7, 0.28, "lowpass");
  }

  /** the fuse — brighter and higher every step of a chain */
  fuse(step: number, size: number): void {
    if (!this.ok()) return;
    const t0 = this.t;
    const semis = PENTA[Math.min(PENTA.length - 1, step - 1)] ?? 0;
    const base = 392; // G4
    const hz = base * 2 ** (semis / 12);
    this.hit(t0, 0.14, 4200, 2.2, 0.045, "highpass");
    this.bell(t0, hz, 0.3, 0.42 + size * 0.05, 2.41, 260 + step * 40);
    this.bell(t0 + 0.012, hz * 2, 0.12, 0.24, 3.13, 140);
    this.tone(t0, hz / 2, hz / 2, 0.14, 0.3, "triangle");
    if (size >= 3) this.tone(t0 + 0.02, hz * 1.5, hz * 1.5, 0.1, 0.34, "sine");
  }

  /** a core arriving at the gauge */
  core(step: number): void {
    if (!this.ok()) return;
    const semis = PENTA[Math.min(PENTA.length - 1, step)] ?? 0;
    this.tone(this.t, 660 * 2 ** (semis / 12), 990 * 2 ** (semis / 12), 0.09, 0.1, "sine", 0.002);
  }

  chainPeak(step: number): void {
    if (!this.ok()) return;
    const t0 = this.t;
    for (let i = 0; i < 4; i++) {
      const semis = PENTA[Math.min(PENTA.length - 1, step + i)] ?? 0;
      this.tone(t0 + i * 0.045, 523 * 2 ** (semis / 12), 523 * 2 ** (semis / 12), 0.12, 0.26, "triangle");
    }
    this.hit(t0, 0.16, 5200, 1.4, 0.1, "highpass");
  }

  levelUp(): void {
    if (!this.ok()) return;
    const t0 = this.t;
    const root = 261.6;
    for (const [i, semis] of [0, 4, 7, 11, 14].entries()) {
      this.tone(t0 + i * 0.055, root * 2 ** (semis / 12), root * 2 ** (semis / 12), 0.14, 0.7, "sawtooth", 0.02);
    }
    this.tone(t0, 60, 120, 0.3, 0.8, "sine");
    this.hit(t0, 0.2, 900, 0.6, 0.7, "lowpass");
  }

  chargeReady(): void {
    if (!this.ok()) return;
    const t0 = this.t;
    this.bell(t0, 880, 0.16, 0.6, 1.51, 120);
    this.bell(t0 + 0.09, 1320, 0.12, 0.5, 1.51, 120);
  }

  resonanceEnter(): void {
    if (!this.ok()) return;
    const t0 = this.t;
    this.tone(t0, 700, 90, 0.22, 0.55, "sawtooth", 0.01);
    this.hit(t0, 0.22, 2400, 0.8, 0.6, "lowpass");
    this.tone(t0 + 0.05, 44, 40, 0.3, 0.9, "sine");
  }

  resonanceHit(): void {
    if (!this.ok()) return;
    const t0 = this.t;
    this.hit(t0, 0.32, 3000, 0.7, 0.28, "highpass");
    this.tone(t0, 180, 40, 0.42, 0.5, "sine");
    for (let i = 0; i < 6; i++) {
      const semis = PENTA[i] ?? 0;
      this.bell(t0 + i * 0.035, 523 * 2 ** (semis / 12), 0.16, 0.5, 2.02, 300);
    }
  }

  resonanceMiss(): void {
    if (!this.ok()) return;
    const t0 = this.t;
    this.tone(t0, 190, 70, 0.22, 0.34, "square");
    this.hit(t0, 0.14, 700, 1.4, 0.24, "lowpass");
  }

  breach(): void {
    if (!this.ok()) return;
    const t0 = this.t;
    this.tone(t0, 220, 26, 0.4, 1.5, "sawtooth", 0.02);
    this.tone(t0, 110, 20, 0.34, 1.8, "sine");
    this.hit(t0, 0.3, 1800, 0.4, 1.6, "lowpass");
  }

  ui(up = true): void {
    if (!this.ok()) return;
    this.tone(this.t, up ? 620 : 420, up ? 880 : 300, 0.1, 0.09, "triangle");
  }
}
