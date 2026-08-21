/**
 * The audio engine. Everything is synthesised — there is not one asset byte.
 *
 * Signal flow:
 *
 *   drumBus ┐
 *   musicBus├─► preMix ─► colour(lowpass) ─► glue(comp) ─► drive(softclip) ─► master
 *   fxBus   ┘      ▲                                                            │
 *                  │                                                            ▼
 *   reverbReturn ◄─ convolver ◄─ reverbSend                                  analyser ─► out
 *
 * The compressor sits BEFORE the soft clipper, not after. Reversed — which is the
 * order you reach for first — a loud bar hits the clipper flat out and the master bus
 * turns into a square wave, which is exactly what happened here the first time. The
 * clipper is now a safety net that only the transients touch.
 *
 * `colour` is the punishment: a missed phrase sweeps it down to 380 Hz and the whole
 * track goes underwater for a bar. Nothing flashes red; the music just gets worse,
 * which is how a real band tells you that you dropped it.
 */

import { createSafetyBus } from "../../../../packs/shared/game-audio/index.ts";
import { TransportClock } from "./clock.ts";

export type Engine = {
  ctx: AudioContext;
  drumBus: GainNode;
  musicBus: GainNode;
  fxBus: GainNode;
  reverbSend: GainNode;
  colour: BiquadFilterNode;
  master: GainNode;
  analyser: AnalyserNode;
  noise: AudioBuffer;
  /**
   * Current audio-clock time, in seconds — smoothed. See `audio/clock.ts`: the
   * raw `currentTime` advances in output-callback steps and is 0..q too small
   * at any moment you happen to read it.
   */
  now(): number;
  /**
   * Audio-clock time of a moment stamped on the `performance.now()` timeline.
   * The ONLY supported way to turn an input event into transport time.
   */
  timeAtPerf(perfSec: number): number;
  /** Raw `ctx.currentTime`. Diagnostics only — never schedule or judge off it. */
  rawNow(): number;
  /** How much error a raw `currentTime` read is currently carrying, in seconds. */
  clockError(): number;
  /** Output latency in seconds — how far ahead of the speaker the clock runs. */
  latency(): number;
  wave: Float32Array;
  spectrum: Uint8Array;
  /** Refresh `wave` and `spectrum` from the analyser. Call once per rendered frame. */
  sample(): void;
  setMuted(m: boolean): void;
  muted(): boolean;
  resume(): Promise<void>;
  dispose(): void;
};

function softClipCurve(amount: number): Float32Array {
  const n = 2048;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}

/** A synthetic impulse response: decaying noise with a slight early-reflection tilt. */
function makeIR(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = buf.getChannelData(c);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(1 - t, decay);
      // Slightly low-passed noise reads as a room rather than as hiss.
      const white = Math.random() * 2 - 1;
      last = last * 0.42 + white * 0.58;
      const early = i < len * 0.02 ? 1.6 : 1;
      ch[i] = last * env * early * 0.6;
    }
  }
  return buf;
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  return buf;
}

export function createEngine(): Engine {
  const Ctor: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor({ latencyHint: "interactive" });

  const master = ctx.createGain();
  master.gain.value = 0.78;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.72;
  analyser.minDecibels = -84;
  analyser.maxDecibels = -6;

  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20;
  glue.knee.value = 26;
  glue.ratio.value = 6;
  glue.attack.value = 0.004;
  glue.release.value = 0.14;

  const drive = ctx.createWaveShaper();
  drive.curve = softClipCurve(1.25);
  drive.oversample = "2x";

  const colour = ctx.createBiquadFilter();
  colour.type = "lowpass";
  colour.frequency.value = 20000;
  colour.Q.value = 0.9;

  const preMix = ctx.createGain();
  preMix.gain.value = 0.5;

  const drumBus = ctx.createGain();
  const musicBus = ctx.createGain();
  const fxBus = ctx.createGain();
  drumBus.gain.value = 0.9;
  musicBus.gain.value = 0.7;
  fxBus.gain.value = 0.7;

  const convolver = ctx.createConvolver();
  convolver.buffer = makeIR(ctx, 1.9, 2.6);
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 0.8;
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = 0.3;

  drumBus.connect(preMix);
  musicBus.connect(preMix);
  fxBus.connect(preMix);
  reverbSend.connect(convolver);
  convolver.connect(reverbReturn);
  reverbReturn.connect(preMix);

  preMix.connect(colour);
  colour.connect(glue);
  glue.connect(drive);
  drive.connect(master);
  master.connect(analyser);
  // The last thing between this game and a child's ears. Everything the
  // pack makes now passes a limiter and a hard -1 dBFS ceiling instead of
  // going straight to the output. See packs/shared/game-audio/.
  const safety = createSafetyBus(ctx);
  analyser.connect(safety.input);

  const noise = makeNoise(ctx, 2);
  const wave = new Float32Array(analyser.fftSize);
  const spectrum = new Uint8Array(analyser.frequencyBinCount);

  let isMuted = false;
  let prevGain = 0.9;

  // The transport. Everything above this line makes sound; this is the only
  // thing that says WHEN, and there is deliberately exactly one of it.
  const clock = new TransportClock({
    audio: () => ctx.currentTime,
    perf: () => performance.now() / 1000,
  });

  return {
    ctx,
    drumBus,
    musicBus,
    fxBus,
    reverbSend,
    colour,
    master,
    analyser,
    noise,
    wave,
    spectrum,
    now: () => clock.now(),
    timeAtPerf: (perfSec) => clock.timeAtPerf(perfSec),
    rawNow: () => ctx.currentTime,
    clockError: () => clock.quantisationError(),
    latency: () => {
      const c = ctx as AudioContext & { outputLatency?: number };
      const out = typeof c.outputLatency === "number" && c.outputLatency > 0 ? c.outputLatency : 0;
      return out || ctx.baseLatency || 0.012;
    },
    sample() {
      analyser.getFloatTimeDomainData(wave);
      analyser.getByteFrequencyData(spectrum);
    },
    setMuted(m) {
      if (m === isMuted) return;
      isMuted = m;
      const t = ctx.currentTime;
      if (m) {
        prevGain = master.gain.value;
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(0.0001, t, 0.02);
      } else {
        master.gain.cancelScheduledValues(t);
        master.gain.setTargetAtTime(prevGain, t, 0.02);
      }
    },
    muted: () => isMuted,
    async resume() {
      if (ctx.state !== "running") await ctx.resume();
    },
    dispose() {
      try {
        master.disconnect();
        void ctx.close();
      } catch {
        /* already gone */
      }
    },
  };
}
