/**
 * The bazaar's sound. WebAudio only, zero assets, never required, never
 * load-bearing.
 *
 * BZ-LAW-13 — **every sound is caused by something visible.** If you can hear
 * it, you can find it on screen. The chimes ring because the simulated chime
 * crossed zero. The escapement ticks because the lamp's escapement wheel
 * advanced. Ambience that comes from nowhere is a soundtrack, and a soundtrack
 * is a different product.
 *
 * BZ-09 — the street renders and plays with `AudioContext` stubbed to throw.
 * Every entry point here is wrapped; failure of any kind is a silent no-op.
 */

const AMBIENCE_CEILING = 0.032; // ≈ −30 dBFS
const MASTER_CEILING = 0.5; // ≈ −6 dBFS
const POLYPHONY = 12;

export class Bed {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private conv: ConvolverNode | null = null;
  private voices = 0;
  private timers: number[] = [];
  private started = false;
  private open = true;
  private duck = 1;

  get isOpen(): boolean {
    return this.open;
  }

  /** Called on the first user gesture, never before. */
  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      const Ctor: typeof AudioContext | undefined =
        (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
        (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -6;
      comp.ratio.value = 20;
      comp.knee.value = 0;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      comp.connect(ctx.destination);

      const master = ctx.createGain();
      master.gain.value = MASTER_CEILING;
      master.connect(comp);
      this.master = master;

      const conv = ctx.createConvolver();
      conv.buffer = syntheticIR(ctx, 1.8);
      conv.connect(master);
      this.conv = conv;

      const amb = ctx.createGain();
      amb.gain.value = AMBIENCE_CEILING;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2500;
      amb.connect(lp);
      lp.connect(conv);
      amb.connect(master);
      this.ambience = amb;

      this.crowd();
      this.fountain();
      this.schedule();
    } catch {
      this.ctx = null;
    }
  }

  setOpen(v: boolean): void {
    this.open = v;
    try {
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(v ? MASTER_CEILING * this.duck : 0, this.ctx.currentTime, 0.25);
      }
    } catch {
      /* silent */
    }
  }

  /** −9 dB when a preview is centred; silent while a game owns the sound. */
  setDuck(level: "none" | "preview" | "mute"): void {
    this.duck = level === "mute" ? 0 : level === "preview" ? 0.35 : 1;
    this.setOpen(this.open);
  }

  suspend(): void {
    try {
      void this.ctx?.suspend();
    } catch {
      /* silent */
    }
  }

  resume(): void {
    try {
      void this.ctx?.resume();
    } catch {
      /* silent */
    }
  }

  destroy(): void {
    for (const id of this.timers) clearInterval(id);
    this.timers = [];
    try {
      void this.ctx?.close();
    } catch {
      /* silent */
    }
    this.ctx = null;
  }

  // ── the bed ─────────────────────────────────────────────────────────────

  /** Distant crowd: never intelligible, never a word. */
  private crowd(): void {
    const ctx = this.ctx;
    const amb = this.ambience;
    if (!ctx || !amb) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = pinkNoise(ctx, 6);
      src.loop = true;
      for (const [f, q, gain] of [
        [400, 0.7, 0.7],
        [1200, 1.2, 0.4],
      ] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f;
        bp.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = gain;
        src.connect(bp);
        bp.connect(g);
        g.connect(amb);
        // A slow breath on the level: the square is never at one volume.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lg = ctx.createGain();
        lg.gain.value = gain * 0.3;
        lfo.connect(lg);
        lg.connect(g.gain);
        lfo.start();
      }
      src.start();
    } catch {
      /* silent */
    }
  }

  /** The fountain in the square. High-passed noise, and the odd droplet. */
  private fountain(): void {
    const ctx = this.ctx;
    const amb = this.ambience;
    if (!ctx || !amb) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = pinkNoise(ctx, 4);
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 800;
      const g = ctx.createGain();
      g.gain.value = 0.32;
      src.connect(hp);
      hp.connect(g);
      g.connect(amb);
      src.start();
    } catch {
      /* silent */
    }
  }

  private schedule(): void {
    const every = (ms: number, fn: () => void) => {
      const id = setInterval(() => {
        try {
          fn();
        } catch {
          /* silent */
        }
      }, ms) as unknown as number;
      this.timers.push(id);
    };
    // The coppersmith: irregular groups, then a long silence.
    every(9000, () => {
      if (Math.random() < 0.45) this.coppersmith();
    });
    // A call across the square. Wordless — not an adhan, not language.
    every(45000, () => {
      if (Math.random() < 0.6) this.call();
    });
    // The escapement: the only sound in the bazaar that indexes time, and the
    // quietest thing in it.
    every(4000, () => this.escapement());
    // A droplet in the fountain basin.
    every(3000, () => {
      if (Math.random() < 0.5) this.droplet();
    });
  }

  // ── events, each caused by something on screen ──────────────────────────

  /** An inharmonic strike: six partials, descending decays, zero attack. */
  strike(pan = 0, gain = 0.5, f0 = 320): void {
    const ctx = this.ctx;
    const bus = this.conv ?? this.master;
    if (!ctx || !bus || this.voices > POLYPHONY) return;
    try {
      const ratios = [1, 2.76, 5.4, 8.93, 13.34, 18.64];
      const decays = [1.8, 1.2, 0.8, 0.5, 0.32, 0.2];
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-0.7, Math.min(0.7, pan));
      p.connect(bus);
      const now = ctx.currentTime;
      for (let i = 0; i < ratios.length; i++) {
        const osc = ctx.createOscillator();
        osc.frequency.value = f0 * ratios[i]!;
        const g = ctx.createGain();
        g.gain.setValueAtTime((gain * 0.24) / (i + 1), now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]!);
        osc.connect(g);
        g.connect(p);
        osc.start(now);
        osc.stop(now + decays[i]! + 0.05);
        this.voices++;
        osc.onended = () => {
          this.voices--;
          try {
            osc.disconnect();
            g.disconnect();
          } catch {
            /* silent */
          }
        };
      }
    } catch {
      /* silent */
    }
  }

  private coppersmith(): void {
    const n = 3 + Math.floor(Math.random() * 5);
    const pan = Math.random() * 1.2 - 0.6;
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.strike(pan, 0.16, 240), i * 420 + (Math.random() - 0.5) * 36);
    }
  }

  /** A wind chime, rung because the visible chime's swing crossed zero. */
  chime(pan = 0): void {
    const pent = [293.66, 329.63, 392.0, 440.0, 493.88];
    this.strike(pan, 0.14, pent[Math.floor(Math.random() * pent.length)]!);
  }

  private droplet(): void {
    const ctx = this.ctx;
    const bus = this.conv ?? this.master;
    if (!ctx || !bus) return;
    try {
      const osc = ctx.createOscillator();
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      const d = ctx.createDelay();
      d.delayTime.value = 0.007;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      osc.connect(g);
      g.connect(d);
      d.connect(fb);
      fb.connect(d);
      d.connect(bus);
      g.connect(bus);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      /* silent */
    }
  }

  private escapement(): void {
    const ctx = this.ctx;
    const bus = this.master;
    if (!ctx || !bus) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = pinkNoise(ctx, 0.02);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 3200;
      bp.Q.value = 8;
      const g = ctx.createGain();
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.035, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      src.connect(bp);
      bp.connect(g);
      g.connect(bus);
      src.start(now);
    } catch {
      /* silent */
    }
  }

  /** A shutter coming down. The most beautiful sound of the day. */
  shutter(pan = 0): void {
    const ctx = this.ctx;
    const bus = this.conv ?? this.master;
    if (!ctx || !bus) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = pinkNoise(ctx, 1);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 700;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      const now = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(bp);
      bp.connect(g);
      g.connect(p);
      p.connect(bus);
      src.start(now);
      src.stop(now + 1);
      for (let i = 0; i < 3; i++) setTimeout(() => this.strike(pan, 0.07, 120), 950 + i * 90);
    } catch {
      /* silent */
    }
  }

  /** A wordless vendor's cry: formants, a falling contour, heavy reverb. */
  private call(): void {
    const ctx = this.ctx;
    const bus = this.conv ?? this.master;
    if (!ctx || !bus) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.setValueAtTime(186, now + 0.6);
      osc.frequency.setValueAtTime(156, now + 1.1);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, now);
      out.gain.linearRampToValueAtTime(0.02, now + 0.12);
      out.gain.setValueAtTime(0.02, now + 1.2);
      out.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
      for (const [f, q] of [
        [620, 8],
        [1180, 10],
        [2600, 12],
      ] as const) {
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = f;
        bp.Q.value = q;
        osc.connect(bp);
        bp.connect(out);
      }
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.2 - 0.6;
      out.connect(p);
      p.connect(bus);
      osc.start(now);
      osc.stop(now + 1.7);
    } catch {
      /* silent */
    }
  }
}

// ── synthesis helpers ──────────────────────────────────────────────────────

function pinkNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
  }
  return buf;
}

function syntheticIR(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6) * 0.5;
    }
  }
  return buf;
}
