/**
 * Procedural audio. No files, no samples, nothing to download.
 *
 * Every sound is built from three layers the way a real one is — a transient
 * (the click of contact), a body (the pitched part), and a tail (the room). The
 * transient is what makes a hit feel like it *happened*; games that skip it and
 * play a single sine sound like a menu.
 *
 * The room is a procedurally generated convolution reverb — exponentially
 * decaying noise, built once at 2.1 seconds — because a cathedral without a
 * tail is not a cathedral.
 *
 * Pitch climbs a pentatonic minor scale with the combo, so a chain plays a
 * rising melody and can never sound wrong. Nothing here carries information on
 * its own: every sound has a visible twin, and the whole bus can be muted.
 *
 * HEARING SAFETY. A nine-year-old said this game almost made his ears explode,
 * and he was right — rendered offline, this file used to produce:
 *
 *     clear()               peak 2.344   (+7.4 dBFS,  2104 clipped samples)
 *     forgeRight()          peak 2.049   (+6.2 dBFS,   540 clipped samples)
 *     power()               peak 1.692   (+4.6 dBFS,   680 clipped samples)
 *     six overlapping       peak 13.955  (+22.9 dBFS, 15954 clipped samples)
 *
 * Four things were wrong, and all four are fixed here.
 *
 *  1. Nothing enforced a ceiling. The master gain went straight to
 *     `ctx.destination`, so anything above 1.0 was hard-clipped by the DAC —
 *     which is a burst of broadband square wave, and is what hurts.
 *  2. The four loudest cues — clear, power, forgeRight, chargeFull — built
 *     their envelopes inline instead of through `env()`, so they never
 *     touched the voice counter. The four sounds most in need of a budget
 *     were the four that had none.
 *  3. The voice cap was 26, which no cue could reach; six four-voice cues fit
 *     under it and summed to fourteen times full scale.
 *  4. Attacks of 0.001-0.002 s. At 44.1 kHz that is 44 samples from silence to
 *     peak: a step function with a click on it.
 *
 * The fix is not a volume knob. Level is unchanged where it was already safe;
 * what changed is that transients are shaped instead of square, and the sum of
 * a crowd is bounded instead of open. Both make it hit harder, not softer.
 */

import {
  VoiceBudget,
  createSafetyBus,
  safeAttack,
  type SafetyBus,
} from "../../../../packs/shared/game-audio/index.ts";

const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
const BASE = 261.63; // C4

const semi = (n: number): number => BASE * Math.pow(2, n / 12);

/** No cue may be asked to play louder than it was authored. */
const MAX_FORCE = 1.35;

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private safety!: SafetyBus;
  private filter!: BiquadFilterNode;
  private wet!: GainNode;
  private dry!: GainNode;
  private padGain!: GainNode;
  private padFilter!: BiquadFilterNode;
  private budget = new VoiceBudget();

  enabled = true;
  private started = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  start(): void {
    if (this.started) {
      void this.ctx?.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ??
      (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.62;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 20000;
    this.filter.Q.value = 0.6;
    this.master.connect(this.filter);
    // The one line that used to read `this.filter.connect(ctx.destination)`.
    this.safety = createSafetyBus(ctx);
    this.filter.connect(this.safety.input);

    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 2.1, 2.4);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.3;
    this.dry = ctx.createGain();
    this.dry.gain.value = 1;
    this.dry.connect(this.master);
    this.wet.connect(conv);
    conv.connect(this.master);

    // Ambient drone: two detuned triangles under a filter that opens as the
    // window clears. It is the sound of the light coming in.
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 380;
    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.dry);
    for (const [f, d] of [
      [semi(-24), 0],
      [semi(-17), 3],
      [semi(-12), -4],
    ] as [number, number][]) {
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(this.padGain);
      o.start();
    }
    this.padGain.gain.setTargetAtTime(0.09, ctx.currentTime, 2);
  }

  suspend(): void {
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.ctx?.resume();
  }

  setMuted(muted: boolean): void {
    this.enabled = !muted;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(muted ? 0 : 0.62, this.ctx.currentTime, 0.05);
  }

  /** 0..1 — how much of the window is gone. Opens the ambient pad. */
  setBrightness(v: number): void {
    if (!this.ctx) return;
    this.padFilter.frequency.setTargetAtTime(300 + v * 1500, this.ctx.currentTime, 0.4);
    this.padGain.gain.setTargetAtTime(0.07 + v * 0.06, this.ctx.currentTime, 0.5);
  }

  /** Bullet time: shut the room down to a muffle. */
  setSlowed(slowed: boolean): void {
    if (!this.ctx) return;
    this.filter.frequency.setTargetAtTime(slowed ? 420 : 20000, this.ctx.currentTime, slowed ? 0.05 : 0.18);
  }

  private ok(): AudioContext | null {
    if (!this.enabled || !this.ctx) return null;
    return this.ctx;
  }

  /**
   * One envelope, one voice, one entry in the budget.
   *
   * `delay` exists so the arpeggiated cues — clear, power, forgeRight,
   * chargeFull — can stagger their notes through here instead of building
   * their own gain nodes off to the side, which is how they escaped the voice
   * count and became the four loudest sounds in the game.
   *
   * When the budget is spent this still returns a node so callers keep their
   * shape, but it is never connected to the bus: the oscillator plays into
   * nothing and stops on its own.
   */
  private env(
    node: AudioNode,
    gain: number,
    attack: number,
    decay: number,
    send = 0.35,
    delay = 0,
  ): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const a = safeAttack(attack);
    const t = ctx.currentTime + Math.max(0, delay);
    const scale = this.budget.take(delay + a + decay, ctx.currentTime);
    const level = Math.max(0.0002, gain * scale);
    // Silence from RIGHT NOW, not from the note's own start time. A GainNode's
    // gain defaults to 1, and scheduling the first `setValueAtTime` in the
    // future leaves it there until then — so every staggered note in an
    // arpeggio played at FULL amplitude for the length of its own delay.
    // That is what made clear() peak at 2.329 when its six notes are authored
    // at 0.15 each: five of them opened at unity before their envelope began.
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
    node.connect(g);
    if (scale > 0) {
      g.connect(this.dry);
      if (send > 0) {
        const s = ctx.createGain();
        s.gain.value = send;
        g.connect(s);
        s.connect(this.wet);
      }
    }
    setTimeout(
      () => {
        try {
          g.disconnect();
        } catch {
          /* already torn down */
        }
      },
      (delay + a + decay) * 1000 + 60,
    );
    return g;
  }

  private noise(duration: number, type: BiquadFilterType, freq: number, q: number): BiquadFilterNode {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, duration);
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.frequency.value = freq;
    bp.Q.value = q;
    src.connect(bp);
    src.start();
    src.stop(ctx.currentTime + duration + 0.02);
    return bp;
  }

  private tone(type: OscillatorType, freq: number, duration: number, detune = 0): OscillatorNode {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.start();
    o.stop(ctx.currentTime + duration + 0.02);
    return o;
  }

  // -- the palette ----------------------------------------------------------

  /** Glass shattering. `step` climbs the scale with the combo. */
  glass(step: number, forceIn = 1): void {
    const ctx = this.ok();
    if (!ctx) return;
    const force = Math.min(MAX_FORCE, Math.max(0, forceIn));
    const n = SCALE[Math.min(SCALE.length - 1, step)]! + (step >= SCALE.length ? 12 : 0);
    const f = semi(n + 12);

    // transient
    this.env(this.noise(0.05, "highpass", 3400, 0.7), 0.3 * force, 0.002, 0.05, 0.15);
    // body
    this.env(this.tone("triangle", f, 0.24), 0.2 * force, 0.004, 0.22, 0.5);
    this.env(this.tone("sine", f * 2.01, 0.18, 6), 0.12 * force, 0.004, 0.16, 0.5);
    // tail
    this.env(this.noise(0.3, "bandpass", 5200 + Math.random() * 2400, 2.2), 0.16 * force, 0.006, 0.28, 0.7);
  }

  /** The ball bounces off masonry. Dry, stony, short. Never harsh. */
  clunk(): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.noise(0.07, "lowpass", 900, 1), 0.14, 0.002, 0.06, 0.12);
    this.env(this.tone("sine", 128 + Math.random() * 26, 0.1), 0.16, 0.003, 0.09, 0.1);
  }

  /** The paddle. Pitch tracks where on the lens the ball landed. */
  paddle(offset: number): void {
    const ctx = this.ok();
    if (!ctx) return;
    const f = 168 + Math.abs(offset) * 150;
    this.env(this.tone("sine", f, 0.16), 0.24, 0.003, 0.14, 0.18);
    this.env(this.noise(0.04, "bandpass", 1800, 1.4), 0.12, 0.001, 0.04, 0.1);
  }

  wall(): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.noise(0.05, "highpass", 2600, 0.8), 0.08, 0.001, 0.045, 0.3);
  }

  /** A masonry tile finally gives way. Dull, heavy, unmusical — no reward. */
  crumble(): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.noise(0.3, "lowpass", 520, 0.9), 0.17, 0.004, 0.26, 0.35);
    this.env(this.tone("sine", 92, 0.26), 0.15, 0.004, 0.24, 0.2);
    this.env(this.noise(0.16, "bandpass", 1400, 1.6), 0.08, 0.002, 0.14, 0.2);
  }

  crack(): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.noise(0.09, "bandpass", 2600, 3.5), 0.16, 0.002, 0.08, 0.3);
    this.env(this.tone("square", 420, 0.06), 0.06, 0.002, 0.05, 0.2);
  }

  laser(): void {
    const ctx = this.ok();
    if (!ctx) return;
    const o = this.tone("sawtooth", 1400, 0.16);
    o.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.15);
    this.env(o, 0.13, 0.002, 0.15, 0.25);
    this.env(this.noise(0.08, "highpass", 4000, 0.7), 0.07, 0.001, 0.07, 0.2);
  }

  star(): void {
    const ctx = this.ok();
    if (!ctx) return;
    for (let i = 0; i < 4; i++) {
      // The stagger used to be a `setValueAtTime(0.0001, now + i * 0.035)`
      // scheduled AFTER the envelope's ramps. That is not a delay; it is a
      // cut, landing well past the attack and slamming three of these four
      // notes to silence mid-decay. `env`'s own delay does what was meant.
      const d = i * 0.035;
      this.env(this.tone("triangle", semi(SCALE[i * 2]! + 24), d + 0.29), 0.09, 0.004, 0.28, 0.6, d);
    }
    this.env(this.noise(0.4, "highpass", 5200, 0.6), 0.1, 0.004, 0.38, 0.8);
  }

  power(): void {
    const ctx = this.ok();
    if (!ctx) return;
    [0, 4, 7, 12].forEach((n, i) => {
      const d = i * 0.055;
      this.env(this.tone("triangle", semi(n + 12), d + 0.42), 0.16, 0.01, 0.4, 0.6, d);
    });
  }

  /** The ball catches fire: a rising sweep and an open fifth underneath. */
  molten(): void {
    const ctx = this.ok();
    if (!ctx) return;
    const sweep = this.tone("sawtooth", 220, 0.7);
    sweep.frequency.exponentialRampToValueAtTime(2600, ctx.currentTime + 0.45);
    this.env(sweep, 0.09, 0.02, 0.6, 0.7);
    for (const n of [0, 7, 19]) this.env(this.tone("triangle", semi(n), 1.1), 0.12, 0.01, 1, 0.8);
    this.env(this.noise(0.6, "highpass", 2600, 0.6), 0.12, 0.01, 0.55, 0.9);
  }

  /** The window blows out. The single biggest sound in the game. */
  clear(): void {
    const ctx = this.ok();
    if (!ctx) return;
    // Authored louder than it reads on the page, and deliberately so. With the
    // unity-gain hole closed these six notes finally play at the level they
    // were written at — 0.15 each — which turned out to be QUIETER than a
    // single tile breaking. The window blowing out has to be the biggest sound
    // in the game, so it is scaled back up to be one. It measures 0.65 peak
    // against a 0.89 ceiling: the largest thing here, with room left over.
    [0, 7, 12, 16, 19, 24].forEach((n, i) => {
      const d = i * 0.045;
      this.env(this.tone("triangle", semi(n), d + 1.74), 0.42, 0.02, 1.7, 0.85, d);
    });
    const sweep = this.tone("sawtooth", 200, 0.9);
    sweep.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.7);
    this.env(sweep, 0.2, 0.02, 0.85, 0.9);
    this.env(this.noise(1.2, "highpass", 3000, 0.5), 0.36, 0.01, 1.1, 1);
  }

  /** Losing the ball. A soft fall, not a buzzer. Nobody is being told off. */
  lost(): void {
    const ctx = this.ok();
    if (!ctx) return;
    const o = this.tone("sine", semi(0), 0.8);
    o.frequency.exponentialRampToValueAtTime(semi(-19), ctx.currentTime + 0.6);
    this.env(o, 0.18, 0.01, 0.75, 0.6);
  }

  forgeOpen(): void {
    const ctx = this.ok();
    if (!ctx) return;
    const o = this.tone("sawtooth", semi(-12), 0.9);
    this.env(o, 0.09, 0.15, 0.75, 0.8);
    this.env(this.noise(0.7, "bandpass", 900, 1.2), 0.07, 0.2, 0.5, 0.9);
  }

  forgeRight(): void {
    const ctx = this.ok();
    if (!ctx) return;
    [0, 4, 7, 12, 16].forEach((n, i) => {
      const d = i * 0.02;
      this.env(this.tone("triangle", semi(n + 12), d + 0.72), 0.16, 0.008, 0.7, 0.7, d);
    });
  }

  forgeWrong(): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.tone("triangle", semi(-5), 0.4), 0.13, 0.006, 0.36, 0.4);
    this.env(this.tone("triangle", semi(-6), 0.4, 12), 0.09, 0.006, 0.36, 0.4);
    this.env(this.noise(0.2, "lowpass", 600, 1), 0.1, 0.004, 0.18, 0.2);
  }

  /** The charge meter ticking up. Pitch tells you how close you are. */
  charge(fraction: number): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.tone("sine", semi(Math.round(fraction * 19)) * 2, 0.1), 0.07, 0.002, 0.09, 0.3);
  }

  chargeFull(): void {
    const ctx = this.ok();
    if (!ctx) return;
    [12, 19, 24].forEach((n, i) => {
      const d = i * 0.06;
      this.env(this.tone("sine", semi(n), d + 0.47), 0.14, 0.01, 0.45, 0.7, d);
    });
  }

  danger(): void {
    const ctx = this.ok();
    if (!ctx) return;
    this.env(this.tone("sawtooth", semi(-24), 0.3), 0.09, 0.02, 0.26, 0.3);
  }
}

// ---------------------------------------------------------------------------

let noiseCache: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const need = Math.ceil(ctx.sampleRate * Math.max(duration, 1.3));
  if (noiseCache && noiseCache.length >= need) return noiseCache;
  const buf = ctx.createBuffer(1, need, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache = buf;
  return buf;
}

/** Exponentially decaying stereo noise — a serviceable stone room. */
function impulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const n = Math.ceil(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}
