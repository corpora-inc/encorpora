/**
 * Asset-free Web Audio. Every sound is transient + body + tail, and every one
 * takes a pitch jitter so a hundred bolt shots in ten seconds never fatigue.
 *
 * Audio never carries information alone — every cue it makes has a visual twin.
 */

import { createSafetyBus, safeAttack } from "../../../../packs/shared/game-audio/index.ts";

const NOISE_SECONDS = 2;

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private comp!: DynamicsCompressorNode;
  private noise!: AudioBuffer;
  private rumbleGain!: GainNode;
  private started = false;
  enabled = true;
  private lastAt = new Map<string, number>();
  private voices = 0;

  /** must be called from a user gesture on iOS */
  async start(): Promise<void> {
    if (this.started) return;
    const Ctor: typeof AudioContext | undefined =
      (globalThis as { AudioContext?: typeof AudioContext }).AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor({ latencyHint: "interactive" });
    this.ctx = ctx;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -18;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 8;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.2;

    this.master = ctx.createGain();
    this.master.gain.value = 0.75;
    this.master.connect(this.comp);
    // The last thing between this game and a child's ears. Everything the
    // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
    // going straight to the output. See packs/shared/game-audio/.
    const safety = createSafetyBus(ctx);
    this.comp.connect(safety.input);

    // one shared noise buffer — allocating per shot is how you drop frames
    const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      brown = (brown + white * 0.02) / 1.02;
      d[i] = white * 0.7 + brown * 3.2;
    }
    this.noise = buf;

    this.startRumble();
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  }

  resume(): void {
    void this.ctx?.resume().catch(() => {});
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.75 : 0;
  }

  /** the lava bed — gain rides wave intensity so the room gets tense on its own */
  private startRumble(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 96;
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start();
    this.rumbleGain = g;
  }

  setIntensity(v: number): void {
    if (!this.rumbleGain || !this.ctx) return;
    const target = 0.05 + Math.min(1, Math.max(0, v)) * 0.16;
    this.rumbleGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
  }

  private ok(key: string, minGap: number): boolean {
    if (!this.ctx || !this.enabled) return false;
    if (this.voices > 26) return false;
    const now = this.ctx.currentTime;
    const last = this.lastAt.get(key) ?? -1;
    if (now - last < minGap) return false;
    this.lastAt.set(key, now);
    return true;
  }

  private track(node: AudioScheduledSourceNode, dur: number): void {
    this.voices++;
    node.onended = () => {
      this.voices--;
    };
    node.stop(this.ctx!.currentTime + dur);
  }

  private env(gain: number, attackIn: number, decay: number): GainNode {
    // The shared floor on onset time. Some cues here asked for 0.002 s —
    // 88 samples from silence to peak, which is a step function with a click
    // on it, and the click is most of what a child hears as "too loud".
    const attack = safeAttack(attackIn);
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.env(gain, 0.004, dur);
    o.connect(g);
    g.connect(dest);
    o.start();
    this.track(o, dur + 0.06);
  }

  private hiss(
    dur: number,
    gain: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    dest: AudioNode,
  ): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const t = ctx.currentTime;
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    bp.Q.value = 1.1;
    const g = this.env(gain, 0.002, dur);
    s.connect(bp);
    bp.connect(g);
    g.connect(dest);
    s.start(t + Math.random() * 0.4);
    this.track(s, dur + 0.06);
  }

  // -- the palette ----------------------------------------------------------

  /** bolt tower: a tight metallic snap */
  bolt(): void {
    if (!this.ok("bolt", 0.022)) return;
    const j = 1 + (Math.random() - 0.5) * 0.22;
    this.hiss(0.05, 0.1, "bandpass", 2600 * j, 1100 * j, this.master);
    this.tone("square", 620 * j, 300 * j, 0.06, 0.05, this.master);
  }

  /** mortar: a chest thump with a real sub */
  mortar(): void {
    if (!this.ok("mortar", 0.05)) return;
    const j = 1 + (Math.random() - 0.5) * 0.16;
    this.tone("sine", 140 * j, 38, 0.34, 0.34, this.master);
    this.hiss(0.2, 0.16, "lowpass", 900 * j, 180, this.master);
  }

  /** chain lightning arc */
  arc(): void {
    if (!this.ok("arc", 0.03)) return;
    const j = 1 + (Math.random() - 0.5) * 0.3;
    this.hiss(0.13, 0.11, "highpass", 1500 * j, 5200 * j, this.master);
    this.tone("sawtooth", 900 * j, 2100 * j, 0.09, 0.03, this.master);
  }

  /** obsidian cracking — the pop that makes killing feel like popping bubble wrap */
  shatter(size = 1): void {
    if (!this.ok("shatter", 0.016)) return;
    const j = (1 + (Math.random() - 0.5) * 0.34) / size;
    this.hiss(0.1 * size, 0.13, "bandpass", 3400 * j, 700 * j, this.master);
    this.tone("triangle", 420 * j, 120 * j, 0.09 * size, 0.07, this.master);
  }

  /** boss down: everything drops an octave and the floor gives way */
  bossDown(): void {
    if (!this.ok("boss", 0.4)) return;
    this.tone("sine", 190, 26, 1.1, 0.42, this.master);
    this.hiss(0.85, 0.24, "lowpass", 2600, 120, this.master);
    this.tone("triangle", 300, 74, 0.6, 0.12, this.master);
  }

  /** a struck bell for a correct answer — pitch tracks difficulty, never a streak */
  forgeStrike(difficulty: number): void {
    if (!this.ok("strike", 0.02)) return;
    // C-major pentatonic over two octaves, indexed by how hard the problem was
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
    const idx = Math.min(scale.length - 1, Math.floor(difficulty * scale.length));
    const f = scale[idx] as number;
    this.hiss(0.05, 0.16, "bandpass", 4200, 1800, this.master); // hammer transient
    this.tone("sine", f, f, 0.5, 0.16, this.master); // body
    this.tone("triangle", f * 2.01, f * 2.0, 0.32, 0.05, this.master); // shimmer
    this.tone("sine", f * 0.5, f * 0.5, 0.7, 0.06, this.master); // tail
  }

  /** a wrong answer: the anvil goes cold. Dull, not cruel. */
  quench(): void {
    if (!this.ok("quench", 0.1)) return;
    this.hiss(0.5, 0.15, "lowpass", 1400, 220, this.master);
    this.tone("sine", 150, 92, 0.28, 0.11, this.master);
  }

  /** a coin arriving at the counter */
  tick(i: number): void {
    if (!this.ok(`tick${i % 3}`, 0.012)) return;
    const f = 1300 + i * 90 + Math.random() * 60;
    this.tone("sine", f, f * 1.4, 0.05, 0.035, this.master);
  }

  /** tower placed */
  build(): void {
    if (!this.ok("build", 0.06)) return;
    this.tone("sine", 90, 220, 0.24, 0.2, this.master);
    this.hiss(0.22, 0.1, "bandpass", 700, 2400, this.master);
  }

  /** upgrade bloom */
  upgrade(): void {
    if (!this.ok("upg", 0.1)) return;
    this.tone("sine", 330, 990, 0.42, 0.16, this.master);
    this.tone("triangle", 660, 1320, 0.3, 0.07, this.master);
    this.hiss(0.34, 0.11, "highpass", 900, 4800, this.master);
  }

  /** the overcharge: sub drop plus a rising sweep, the biggest sound in the game */
  overcharge(): void {
    if (!this.ok("over", 0.5)) return;
    this.tone("sawtooth", 60, 900, 0.85, 0.12, this.master);
    this.tone("sine", 300, 32, 1.2, 0.4, this.master);
    this.hiss(1.0, 0.3, "lowpass", 260, 5200, this.master);
  }

  /** time bending into slow motion */
  slowIn(): void {
    if (!this.ok("slow", 0.3)) return;
    this.tone("sine", 900, 200, 0.55, 0.1, this.master);
  }

  /** the core takes a hit */
  breach(): void {
    if (!this.ok("breach", 0.14)) return;
    this.tone("sawtooth", 220, 60, 0.4, 0.2, this.master);
    this.hiss(0.4, 0.2, "lowpass", 1800, 200, this.master);
  }

  /** the rift opens for a new wave */
  waveHorn(pitch: number): void {
    if (!this.ok("horn", 0.5)) return;
    this.tone("sawtooth", 70 * pitch, 104 * pitch, 1.0, 0.1, this.master);
    this.tone("sine", 140 * pitch, 208 * pitch, 0.8, 0.07, this.master);
  }

  /** the forge goes cold */
  defeat(): void {
    if (!this.ok("defeat", 1)) return;
    this.tone("sine", 260, 40, 2.2, 0.3, this.master);
    this.hiss(2.0, 0.2, "lowpass", 1200, 90, this.master);
  }
}
