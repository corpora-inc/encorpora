/**
 * Every sound in POLARITY is synthesised at runtime — no assets ship.
 *
 * Each hit has the three parts a sound needs to feel physical: a TRANSIENT
 * (click/noise), a BODY (pitched) and a TAIL (filtered decay). Pitch varies per
 * event, and absorbs climb a pentatonic ladder with the chain, so a long chain
 * is audibly a melody going somewhere and forty absorbs in a row never fatigue.
 *
 * Sound never carries information alone: everything audible is also visible.
 */

type Voice = { stop: (t: number) => void };

const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31];

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: DynamicsCompressorNode | null = null;
  private musicGain: GainNode | null = null;
  private voices = 0;
  private lastAt: Record<string, number> = {};
  enabled = true;
  musicOn = true;
  private step = 0;
  private nextNote = 0;
  private timer: number | null = null;
  private intensity = 0;

  /** Must be called from a user gesture on iOS. Safe to call repeatedly. */
  resume(): void {
    if (!this.ctx) {
      const C = (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) as
        | typeof AudioContext
        | undefined;
      if (!C) return;
      try {
        this.ctx = new C();
      } catch (e) {
        console.warn("[polarity] no audio context", e);
        return;
      }
      this.bus = this.ctx.createDynamicsCompressor();
      this.bus.threshold.value = -14;
      this.bus.knee.value = 24;
      this.bus.ratio.value = 8;
      this.bus.attack.value = 0.003;
      this.bus.release.value = 0.18;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.72;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.bus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.musicGain.connect(this.bus);
      this.startClock();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.72 : 0;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.musicGain && this.ctx)
      this.musicGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.15);
  }

  setIntensity(v: number): void {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  dispose(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  // -------------------------------------------------------------------------
  // primitives
  // -------------------------------------------------------------------------

  private gate(key: string, ms: number): boolean {
    const now = performance.now();
    const last = this.lastAt[key] ?? -1e9;
    if (now - last < ms) return false;
    this.lastAt[key] = now;
    return true;
  }

  private env(
    dur: number,
    peak: number,
    attack = 0.004,
    curve: "exp" | "lin" = "exp",
  ): GainNode | null {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || this.voices > 26) return null;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (curve === "exp") g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    else g.gain.linearRampToValueAtTime(0.0001, t + dur);
    this.voices++;
    const done = (): void => {
      this.voices--;
    };
    setTimeout(done, (dur + 0.1) * 1000);
    return g;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    opts?: { bend?: number; lp?: number; attack?: number; dest?: AudioNode },
  ): Voice | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const g = this.env(dur, peak, opts?.attack);
    if (!g) return null;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (opts?.bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.bend), t + dur);
    let node: AudioNode = o;
    if (opts?.lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(opts.lp, t);
      f.Q.value = 0.9;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(opts?.dest ?? (this.bus as AudioNode));
    o.start(t);
    o.stop(t + dur + 0.02);
    return { stop: (s) => o.stop(s) };
  }

  private noise(
    dur: number,
    peak: number,
    opts?: { hp?: number; lp?: number; bend?: number; q?: number },
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = this.env(dur, peak, 0.002);
    if (!g) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 0;
    for (let i = 0; i < n; i++) {
      s = s * 0.55 + (Math.random() * 2 - 1) * 0.45;
      d[i] = s;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const t = ctx.currentTime;
    let node: AudioNode = src;
    if (opts?.hp) {
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = opts.hp;
      node.connect(f);
      node = f;
    }
    if (opts?.lp) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(opts.lp, t);
      if (opts.bend) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.bend), t + dur);
      f.Q.value = opts.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.bus as AudioNode);
    src.start(t);
  }

  private hz(semi: number, base = 196): number {
    return base * Math.pow(2, semi / 12);
  }

  // -------------------------------------------------------------------------
  // the palette
  // -------------------------------------------------------------------------

  absorb(chain: number, pol: number, big: boolean): void {
    if (!this.gate("absorb", 22)) return;
    const semi = PENT[Math.min(PENT.length - 1, chain % PENT.length)] ?? 0;
    const oct = Math.min(2, Math.floor(chain / PENT.length));
    const f = this.hz(semi + oct * 12, pol > 0 ? 262 : 196);
    this.tone(f, big ? 0.24 : 0.13, pol > 0 ? "triangle" : "sine", big ? 0.3 : 0.16, {
      lp: pol > 0 ? 5200 : 2600,
      bend: f * 1.32,
      attack: 0.002,
    });
    if (big) {
      this.tone(f * 0.5, 0.34, "sine", 0.2, { bend: f * 0.52 });
      this.noise(0.07, 0.1, { hp: 1800, lp: 8000 });
    }
  }

  flip(pol: number): void {
    if (!this.gate("flip", 30)) return;
    this.noise(0.09, 0.16, { hp: 400, lp: pol > 0 ? 6500 : 2200, bend: pol > 0 ? 1400 : 5200 });
    this.tone(pol > 0 ? 420 : 300, 0.1, "square", 0.09, { bend: pol > 0 ? 640 : 190, lp: 3200 });
  }

  clutch(): void {
    const base = 523.25;
    for (const [i, m] of [1, 1.5, 2, 3].entries()) {
      const g = this.tone(base * m, 0.9 - i * 0.1, "sine", 0.16 - i * 0.02, { attack: 0.006 });
      void g;
    }
    this.noise(0.5, 0.1, { hp: 3000, lp: 12000, bend: 3000 });
  }

  shoot(pol: number): void {
    if (!this.gate("shoot", 55)) return;
    this.tone(pol > 0 ? 900 : 700, 0.045, "square", 0.035, { bend: pol > 0 ? 1500 : 400, lp: 5000 });
  }

  hitEnemy(weak: boolean): void {
    if (!this.gate("hitE", 26)) return;
    this.noise(weak ? 0.09 : 0.05, weak ? 0.16 : 0.09, { hp: 900, lp: weak ? 9000 : 5000, bend: 1200 });
    if (weak) this.tone(180, 0.09, "triangle", 0.08, { bend: 90 });
  }

  kill(big: boolean): void {
    this.noise(big ? 0.6 : 0.24, big ? 0.42 : 0.24, { lp: big ? 4200 : 3000, bend: 120, q: 2 });
    this.tone(big ? 110 : 190, big ? 0.6 : 0.26, "sine", big ? 0.34 : 0.16, { bend: big ? 38 : 60 });
    if (big) this.tone(58, 0.9, "sine", 0.3, { bend: 26 });
  }

  release(perfect: boolean): void {
    this.tone(perfect ? 180 : 150, 0.5, "sawtooth", 0.24, { bend: perfect ? 1500 : 700, lp: 4200 });
    this.noise(0.42, 0.26, { hp: 200, lp: 11000, bend: 500 });
    this.tone(62, 0.5, "sine", 0.32, { bend: 34 });
    if (perfect) {
      for (const [i, m] of [1, 1.5, 2, 2.5, 3].entries())
        this.tone(392 * m, 0.7 - i * 0.06, "triangle", 0.11, { attack: 0.005 });
    }
  }

  overload(): void {
    this.tone(220, 0.34, "sawtooth", 0.22, { bend: 1400, lp: 2600 });
    this.noise(0.5, 0.34, { lp: 6000, bend: 200, q: 3 });
    this.tone(70, 0.6, "square", 0.2, { bend: 30, lp: 700 });
  }

  hurt(): void {
    this.noise(0.4, 0.4, { lp: 2400, bend: 120, q: 2.4 });
    this.tone(150, 0.3, "sawtooth", 0.24, { bend: 48, lp: 1600 });
    this.tone(93, 0.5, "sine", 0.24, { bend: 40 });
  }

  sealWon(): void {
    const root = 261.63;
    const chord = [1, 1.26, 1.5, 2, 2.52, 3];
    for (const [i, m] of chord.entries()) {
      const o = this.ctx;
      if (!o) return;
      setTimeout(() => {
        this.tone(root * m, 0.85 - i * 0.06, "triangle", 0.15, { attack: 0.006 });
      }, i * 42);
    }
    this.noise(0.7, 0.2, { hp: 2200, lp: 14000, bend: 2500 });
    this.tone(65, 0.8, "sine", 0.3, { bend: 33 });
  }

  /** Never a game-show buzzer. A heavy, dull detonation and a falling minor 3rd. */
  sealWrong(): void {
    this.noise(0.55, 0.4, { lp: 1500, bend: 90, q: 3 });
    this.tone(196, 0.36, "triangle", 0.2, { bend: 165, lp: 1400 });
    this.tone(98, 0.7, "sine", 0.26, { bend: 62 });
  }

  bossIn(): void {
    this.tone(48, 1.5, "sawtooth", 0.3, { bend: 96, lp: 900 });
    this.noise(1.4, 0.2, { lp: 900, bend: 3000, q: 2 });
  }

  stratum(): void {
    for (const [i, m] of [1, 1.5, 2].entries())
      setTimeout(() => this.tone(330 * m, 0.5, "triangle", 0.12), i * 70);
  }

  ui(kind: "tap" | "big"): void {
    if (kind === "tap") this.tone(660, 0.07, "triangle", 0.09, { bend: 880 });
    else {
      this.tone(330, 0.3, "triangle", 0.14, { bend: 660 });
      this.noise(0.2, 0.1, { hp: 2000, lp: 9000 });
    }
  }

  // -------------------------------------------------------------------------
  // music bed — a two-bar pulse that tightens as the run escalates
  // -------------------------------------------------------------------------

  private startClock(): void {
    this.timer = setInterval(() => this.schedule(), 60) as unknown as number;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const dest = this.musicGain;
    if (!ctx || !dest || !this.enabled || !this.musicOn) return;
    const bpm = 104 + this.intensity * 48;
    const spb = 60 / bpm / 2; // eighth notes
    if (this.nextNote < ctx.currentTime) this.nextNote = ctx.currentTime + 0.06;
    while (this.nextNote < ctx.currentTime + 0.25) {
      this.note(this.nextNote, this.step, dest);
      this.step = (this.step + 1) % 32;
      this.nextNote += spb;
    }
  }

  private note(t: number, step: number, dest: GainNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = (peak: number, dur: number, atk = 0.003): GainNode => {
      const n = ctx.createGain();
      n.gain.setValueAtTime(0.0001, t);
      n.gain.linearRampToValueAtTime(peak, t + atk);
      n.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(dest);
      return n;
    };
    const osc = (f: number, type: OscillatorType, dur: number, node: GainNode, lp?: number): void => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (lp) {
        const fl = ctx.createBiquadFilter();
        fl.type = "lowpass";
        fl.frequency.setValueAtTime(lp, t);
        o.connect(fl);
        fl.connect(node);
      } else o.connect(node);
      o.start(t);
      o.stop(t + dur + 0.02);
    };

    // kick on 0 and 12 of every 16
    if (step % 16 === 0 || step % 16 === 10) {
      const n = g(0.34, 0.24);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
      o.connect(n);
      o.start(t);
      o.stop(t + 0.26);
    }
    // driving bass
    const BASS = [0, 0, 3, 0, 5, 0, 3, -2];
    if (step % 2 === 0) {
      const s = BASS[(step / 2) % 8] ?? 0;
      osc(this.hz(s, 65.4), "sawtooth", 0.16, g(0.15, 0.18), 340 + this.intensity * 900);
    }
    // arp, only once the run has heat
    if (this.intensity > 0.12 && step % 2 === 1) {
      const ARP = [12, 19, 24, 19, 15, 22, 27, 22];
      const s = ARP[((step - 1) / 2) % 8] ?? 12;
      osc(this.hz(s, 65.4), "square", 0.07, g(0.05 + this.intensity * 0.04, 0.09), 3200);
    }
    // hat
    if (step % 4 === 2 && this.intensity > 0.28) {
      const n = g(0.05, 0.05);
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7000;
      src.connect(f);
      f.connect(n);
      src.start(t);
    }
  }
}
