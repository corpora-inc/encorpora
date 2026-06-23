/**
 * SynthEngine — a tiny, fully-offline WebAudio synthesizer.
 *
 * Zero binary assets. Every sound is procedurally generated from oscillators,
 * noise buffers, gain envelopes, and a synthesized convolution reverb. Designed
 * for low-latency rhythm-game SFX (snappy attacks, short decays) layered over a
 * persistent synthwave music bed.
 *
 * Routing topology:
 *
 *   voices/noise ──► [dry] ─────────────────────────────┐
 *                └─► [reverbSend] ─► convolver ─► wet ───┤
 *                                                        ▼
 *   music bed ───────────────────► musicBus ───────►  master ─► limiter ─► out
 *
 * Two independent gain buses (`sfxBus`, `musicBus`) hang off the master so the
 * evolving ambient bed can swell/duck on its own envelope while transient SFX
 * stay punchy. A shared convolution reverb gives every cue a cohesive
 * synthwave "room" without per-sound tails.
 *
 * The engine is lazy: the AudioContext is only created/resumed on an explicit
 * unlock() call (driven by the first user gesture) to satisfy mobile autoplay
 * policy. Every public method is a no-op until unlocked, and nothing throws if
 * WebAudio is unavailable.
 */

type Ctor = typeof AudioContext;

function resolveAudioContextCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: Ctor;
    webkitAudioContext?: Ctor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export type WaveKind = OscillatorType;

export interface VoiceSpec {
  /** Oscillator wave shape. */
  type: WaveKind;
  /** Start frequency (Hz). */
  freq: number;
  /** Optional end frequency for a pitch glide over `dur`. */
  freqTo?: number;
  /** Peak gain (0..1) before the master/limiter stage. */
  gain: number;
  /** Linear attack time (s). */
  attack: number;
  /** Exponential-ish release time (s). */
  release: number;
  /** Time offset from "now" before the voice starts (s). */
  delay?: number;
  /** Slight stereo placement, -1 (L) .. 1 (R). */
  pan?: number;
  /** Optional detune in cents for a fatter unison feel. */
  detune?: number;
  /** Reverb send amount 0..1 (0 = bone dry). */
  reverb?: number;
}

export interface NoiseSpec {
  /** Peak gain (0..1). */
  gain: number;
  /** Total duration (s). */
  dur: number;
  /** Lowpass cutoff start (Hz). */
  cutoff: number;
  /** Optional lowpass cutoff end for a sweep. */
  cutoffTo?: number;
  /** Filter type (default "lowpass"). */
  filter?: BiquadFilterType;
  /** Q of the filter. */
  q?: number;
  /** Time offset from "now" (s). */
  delay?: number;
  /** Stereo placement -1..1. */
  pan?: number;
  /** Reverb send amount 0..1. */
  reverb?: number;
}

export class SynthEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Transient SFX sub-bus (hits, misses, risers, stings). */
  private sfxBus: GainNode | null = null;
  /** Sustained music/ambient sub-bus (the evolving bed). */
  private musicBus: GainNode | null = null;
  /** Wet return of the shared reverb. */
  private reverbWet: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly Ctor: Ctor | null;
  private unlocked = false;
  private masterGain = 0.9;
  private muted = false;

  constructor() {
    this.Ctor = resolveAudioContextCtor();
  }

  /** Whether WebAudio is even available in this environment. */
  get supported(): boolean {
    return this.Ctor !== null;
  }

  /** Whether the context is live and ready to make sound. */
  get ready(): boolean {
    return this.unlocked && this.ctx !== null && this.ctx.state === "running";
  }

  /** Whether a user gesture has unlocked (created/resumed) the context. */
  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /**
   * The live AudioContext.state, or null if no context has been created yet.
   * Used by the e2e harness to prove the iOS unlock wiring fires on a gesture.
   */
  get state(): AudioContextState | null {
    return this.ctx ? this.ctx.state : null;
  }

  /** Raw context accessor for advanced subsystems (music bed). Null until unlocked. */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** The music sub-bus node; subsystems connect their output here. */
  get musicDestination(): AudioNode | null {
    return this.musicBus;
  }

  /**
   * Build/resume the AudioContext. Safe to call repeatedly; only the first
   * call constructs the graph. Must be invoked from a user-gesture handler on
   * mobile. Never throws.
   */
  unlock(): void {
    if (!this.Ctor) return;
    try {
      if (!this.ctx) {
        this.ctx = new this.Ctor();
        this.buildGraph();
      }
      if (this.ctx.state === "suspended") {
        // Returns a promise on some browsers; we don't await it.
        void this.ctx.resume();
      }
      this.unlocked = true;
    } catch (err) {
      // Audio is non-essential; degrade silently.
      console.warn("[audio] unlock failed:", err);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      const target = muted ? 0 : this.masterGain;
      try {
        this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
      } catch {
        this.master.gain.value = target;
      }
    }
  }

  /**
   * PAUSE all audio when the app/tab is BACKGROUNDED. Suspending the
   * AudioContext freezes its clock so the music bed's scheduler (which queues
   * beats off ctx.currentTime) doesn't keep running silently while the game
   * loop is frozen — the root cause of the "audio kept playing, game bricked on
   * return" desync. Never throws; no-op if not yet unlocked.
   */
  suspend(): void {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "running") void this.ctx.suspend();
    } catch {
      /* degrade silently */
    }
  }

  /**
   * RESUME audio after returning to the foreground. Mirrors suspend(); the
   * AudioContext clock picks up where it left off so the bed's lookahead math
   * stays coherent. No-op if not unlocked or already running.
   */
  resume(): void {
    if (!this.ctx || !this.unlocked) return;
    try {
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* degrade silently */
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Current transport time; 0 if not yet unlocked. */
  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /**
   * Smoothly ramp the music sub-bus level (0..1). Used by the bed to swell with
   * combo and duck on menus. Never throws.
   */
  setMusicLevel(level: number, ramp = 0.6): void {
    if (!this.musicBus || !this.ctx) return;
    const v = Math.max(0, Math.min(1, level));
    try {
      this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, ramp);
    } catch {
      this.musicBus.gain.value = v;
    }
  }

  private buildGraph(): void {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Soft limiter so stacked transients stay clean on phone speakers.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 24;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.masterGain;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    // Two sub-buses for independent SFX vs. music dynamics.
    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);

    const musicBus = ctx.createGain();
    musicBus.gain.value = 0; // bed starts silent; the MusicBed ramps it in.
    musicBus.connect(master);

    // Shared synthwave reverb (procedural impulse → convolver → wet return).
    const convolver = ctx.createConvolver();
    convolver.buffer = this.makeImpulse(ctx, 1.9, 2.6);
    const reverbWet = ctx.createGain();
    reverbWet.gain.value = 0.85;
    convolver.connect(reverbWet);
    reverbWet.connect(master);

    this.master = master;
    this.sfxBus = sfxBus;
    this.musicBus = musicBus;
    this.convolver = convolver;
    this.reverbWet = reverbWet;
    this.noiseBuffer = this.makeNoiseBuffer(ctx);
  }

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  /**
   * Synthesize a stereo exponential-decay impulse response for the convolver —
   * a "plate"-ish synthwave tail. Slightly decorrelated L/R for width. Fully
   * generated, no IR files.
   */
  private makeImpulse(
    ctx: AudioContext,
    seconds: number,
    decay: number
  ): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Short pre-build (early reflections) then long exponential tail.
        const env = Math.pow(1 - t, decay);
        data[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return buf;
  }

  /**
   * Connect a node to the SFX bus through an optional stereo panner, and add a
   * parallel reverb send if requested. Returns the (panned) dry node.
   */
  private route(node: AudioNode, pan?: number, reverb?: number): AudioNode {
    if (!this.ctx || !this.sfxBus) return node;
    let out: AudioNode = node;
    if (
      pan !== undefined &&
      pan !== 0 &&
      typeof this.ctx.createStereoPanner === "function"
    ) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(panner);
      out = panner;
    }
    out.connect(this.sfxBus);
    if (reverb && reverb > 0 && this.convolver) {
      const send = this.ctx.createGain();
      send.gain.value = Math.min(1, reverb);
      out.connect(send);
      send.connect(this.convolver);
    }
    return out;
  }

  /** Play a single oscillator voice with an AD envelope. */
  playVoice(spec: VoiceSpec): void {
    if (!this.ready || !this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (spec.delay ?? 0);

    const osc = ctx.createOscillator();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(Math.max(20, spec.freq), t0);
    if (spec.freqTo !== undefined) {
      const dur = spec.attack + spec.release;
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, spec.freqTo),
        t0 + dur
      );
    }
    if (spec.detune) osc.detune.setValueAtTime(spec.detune, t0);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, spec.gain),
      t0 + spec.attack
    );
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.attack + spec.release);

    osc.connect(env);
    this.route(env, spec.pan, spec.reverb);

    osc.start(t0);
    osc.stop(t0 + spec.attack + spec.release + 0.02);
    osc.onended = () => {
      try {
        osc.disconnect();
        env.disconnect();
      } catch {
        /* already torn down */
      }
    };
  }

  /** Play a burst of filtered noise (great for thuds, hats, whooshes). */
  playNoise(spec: NoiseSpec): void {
    if (!this.ready || !this.ctx || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (spec.delay ?? 0);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = spec.filter ?? "lowpass";
    filter.frequency.setValueAtTime(Math.max(40, spec.cutoff), t0);
    if (spec.cutoffTo !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(40, spec.cutoffTo),
        t0 + spec.dur
      );
    }
    if (spec.q !== undefined) filter.Q.value = spec.q;

    const env = ctx.createGain();
    const peak = Math.max(0.0002, spec.gain);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + spec.dur * 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);

    src.connect(filter);
    filter.connect(env);
    this.route(env, spec.pan, spec.reverb);

    src.start(t0);
    src.stop(t0 + spec.dur + 0.02);
    src.onended = () => {
      try {
        src.disconnect();
        filter.disconnect();
        env.disconnect();
      } catch {
        /* already torn down */
      }
    };
  }

  /** Tear down the context and free the graph. Idempotent. */
  dispose(): void {
    this.unlocked = false;
    const ctx = this.ctx;
    // Explicitly tear down the reverb return so the convolver tail is freed.
    try {
      this.reverbWet?.disconnect();
      this.convolver?.disconnect();
    } catch {
      /* already torn down */
    }
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.convolver = null;
    this.reverbWet = null;
    this.noiseBuffer = null;
    if (ctx) {
      try {
        void ctx.close();
      } catch {
        /* ignore */
      }
    }
  }
}
