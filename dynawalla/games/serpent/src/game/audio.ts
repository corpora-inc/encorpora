/**
 * Procedural audio. No files, no network, nothing to load.
 *
 * Every sound is built the same way — transient, body, tail — because that is
 * what stops a sound fatiguing after the two-hundredth pickup:
 *   · transient: a few milliseconds of filtered noise. The "click" of contact.
 *   · body:      a pitched oscillator. The identity of the event.
 *   · tail:      a quiet, longer partial into a delay network. The room.
 * Pitch moves with the combo and every event is detuned a few cents at random,
 * so no two bites are acoustically identical.
 *
 * Nothing here ever carries information on its own: every sound has a visual
 * twin (bloom, shard burst, ring, body length), and the whole system can be
 * switched off without losing a single piece of game state.
 */

const STORE_KEY = "serpent.sound";

/** Major pentatonic, ascending — the combo ladder. */
const COMBO_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const BASE_HZ = 349.228; // F4

export type Audio = {
  enabled: boolean;
  ready: boolean;
  resume(): void;
  setEnabled(on: boolean): void;
  eat(step: number): void;
  wrong(): void;
  wall(): void;
  graze(): void;
  depth(n: number): void;
  mutate(): void;
  shield(): void;
  shieldBreak(): void;
  death(): void;
  setBoost(on: boolean): void;
  ambient(on: boolean): void;
  dispose(): void;
};

type Ctx = {
  ac: AudioContext;
  master: GainNode;
  wet: GainNode;
  noise: AudioBuffer;
  boostGain: GainNode;
  boostFilter: BiquadFilterNode;
  droneGain: GainNode;
  nodes: AudioNode[];
};

function readStored(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function createAudio(): Audio {
  let ctx: Ctx | null = null;
  let enabled = readStored();
  let disposed = false;

  function build(): Ctx | null {
    if (disposed) return null;
    const AC: typeof AudioContext | undefined =
      typeof window === "undefined"
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();

    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 12;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.14;
    limiter.connect(ac.destination);

    const master = ac.createGain();
    master.gain.value = 0.55;
    master.connect(limiter);

    // A two-tap feedback delay standing in for the water. Cheap, and it is what
    // makes a 40ms blip sound like it happened somewhere rather than in a box.
    const wet = ac.createGain();
    wet.gain.value = 0.34;
    const d1 = ac.createDelay(1);
    d1.delayTime.value = 0.17;
    const d2 = ac.createDelay(1);
    d2.delayTime.value = 0.263;
    const fb = ac.createGain();
    fb.gain.value = 0.33;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    wet.connect(d1);
    wet.connect(d2);
    d1.connect(lp);
    d2.connect(lp);
    lp.connect(fb);
    fb.connect(d1);
    fb.connect(d2);
    lp.connect(master);

    const len = Math.floor(ac.sampleRate * 1.2);
    const noise = ac.createBuffer(1, len, ac.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;

    // Boost: one long-running filtered noise source whose gain and cutoff are
    // ramped. Starting a source per boost would click.
    const boostSrc = ac.createBufferSource();
    boostSrc.buffer = noise;
    boostSrc.loop = true;
    const boostFilter = ac.createBiquadFilter();
    boostFilter.type = "bandpass";
    boostFilter.frequency.value = 420;
    boostFilter.Q.value = 0.8;
    const boostGain = ac.createGain();
    boostGain.gain.value = 0;
    boostSrc.connect(boostFilter);
    boostFilter.connect(boostGain);
    boostGain.connect(master);
    boostGain.connect(wet);
    boostSrc.start();

    const droneGain = ac.createGain();
    droneGain.gain.value = 0;
    droneGain.connect(master);
    const droneNodes: AudioNode[] = [];
    for (const [hz, detune] of [
      [55, 0],
      [82.5, 6],
      [110, -8],
    ] as Array<[number, number]>) {
      const o = ac.createOscillator();
      o.type = "sine";
      o.frequency.value = hz;
      o.detune.value = detune;
      const g = ac.createGain();
      g.gain.value = hz === 55 ? 0.5 : 0.22;
      o.connect(g);
      g.connect(droneGain);
      o.start();
      droneNodes.push(o, g);
    }
    // A slow swell so the drone never sits perfectly still.
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ac.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);
    lfo.start();

    return {
      ac,
      master,
      wet,
      noise,
      boostGain,
      boostFilter,
      droneGain,
      nodes: [boostSrc, lfo, lfoGain, ...droneNodes],
    };
  }

  function live(): Ctx | null {
    if (!enabled || disposed) return null;
    if (!ctx) ctx = build();
    if (ctx && ctx.ac.state === "suspended") void ctx.ac.resume();
    return ctx;
  }

  function tone(
    c: Ctx,
    type: OscillatorType,
    hz: number,
    at: number,
    dur: number,
    gain: number,
    detuneCents = 0,
    wetSend = 0.5,
  ): void {
    const o = c.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, at);
    o.detune.value = detuneCents;
    const g = c.ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(c.master);
    if (wetSend > 0) {
      const w = c.ac.createGain();
      w.gain.value = wetSend;
      g.connect(w);
      w.connect(c.wet);
    }
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  function sweep(
    c: Ctx,
    type: OscillatorType,
    fromHz: number,
    toHz: number,
    at: number,
    dur: number,
    gain: number,
  ): void {
    const o = c.ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(fromHz, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(toHz, 20), at + dur);
    const g = c.ac.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(c.master);
    const w = c.ac.createGain();
    w.gain.value = 0.6;
    g.connect(w);
    w.connect(c.wet);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  function burst(
    c: Ctx,
    at: number,
    dur: number,
    gain: number,
    filter: BiquadFilterType,
    hz: number,
    q: number,
    hzEnd?: number,
  ): void {
    const s = c.ac.createBufferSource();
    s.buffer = c.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.5;
    const f = c.ac.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(hz, at);
    if (hzEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(hzEnd, 30), at + dur);
    f.Q.value = q;
    const g = c.ac.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f);
    f.connect(g);
    g.connect(c.master);
    const w = c.ac.createGain();
    w.gain.value = 0.45;
    g.connect(w);
    w.connect(c.wet);
    s.start(at);
    s.stop(at + dur + 0.05);
  }

  const api: Audio = {
    get enabled() {
      return enabled;
    },
    get ready() {
      return ctx !== null;
    },

    resume(): void {
      live();
    },

    setEnabled(on: boolean): void {
      enabled = on;
      try {
        localStorage.setItem(STORE_KEY, on ? "on" : "off");
      } catch {
        /* private mode is not an error */
      }
      if (!on && ctx) {
        ctx.master.gain.value = 0;
        ctx.droneGain.gain.value = 0;
      } else if (on && ctx) {
        ctx.master.gain.value = 0.55;
      }
    },

    eat(step: number): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      const semi = COMBO_SEMITONES[Math.min(step, COMBO_SEMITONES.length - 1)] as number;
      const hz = BASE_HZ * 2 ** (semi / 12);
      const cents = (Math.random() - 0.5) * 22;
      burst(c, t, 0.035, 0.16, "bandpass", 2400 + Math.random() * 900, 1.6);
      tone(c, "triangle", hz, t, 0.16, 0.24, cents, 0.35);
      tone(c, "sine", hz * 2, t + 0.01, 0.34, 0.09, cents, 0.8);
    },

    wrong(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      burst(c, t, 0.14, 0.3, "lowpass", 900, 1, 160);
      sweep(c, "sawtooth", 196, 116, t, 0.28, 0.16);
      sweep(c, "sawtooth", 190, 112, t + 0.005, 0.3, 0.13);
      tone(c, "sine", 62, t, 0.34, 0.22, 0, 0.3);
    },

    /** The vent wall: a stone thud with a mineral scrape over it. */
    wall(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      burst(c, t, 0.18, 0.34, "lowpass", 420, 1.2, 90);
      burst(c, t + 0.01, 0.22, 0.12, "bandpass", 2600, 3.4, 900);
      sweep(c, "triangle", 150, 58, t, 0.3, 0.2);
    },

    graze(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      tone(c, "sine", 1760 + Math.random() * 260, t, 0.07, 0.045, 0, 0.7);
    },

    depth(n: number): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      const root = BASE_HZ * 2 ** (((n % 5) * 2) / 12);
      [0, 4, 7, 12].forEach((semi, i) => {
        tone(c, "triangle", root * 2 ** (semi / 12), t + i * 0.075, 0.4, 0.15, (Math.random() - 0.5) * 14, 0.8);
      });
      burst(c, t, 0.5, 0.1, "highpass", 600, 0.7, 3000);
    },

    mutate(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      sweep(c, "sine", 620, 150, t, 0.4, 0.14);
      burst(c, t + 0.06, 0.55, 0.16, "bandpass", 300, 0.9, 2600);
      tone(c, "triangle", BASE_HZ * 1.5, t + 0.42, 0.5, 0.16, 0, 0.9);
      tone(c, "sine", BASE_HZ * 3, t + 0.46, 0.6, 0.07, 0, 0.9);
    },

    shield(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      tone(c, "sine", 880, t, 0.55, 0.16, 0, 0.9);
      tone(c, "sine", 1320, t + 0.02, 0.7, 0.1, 4, 0.9);
      burst(c, t, 0.2, 0.08, "highpass", 2200, 0.6);
    },

    shieldBreak(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      burst(c, t, 0.26, 0.34, "bandpass", 3200, 2.2, 700);
      sweep(c, "square", 700, 180, t, 0.24, 0.12);
    },

    death(): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      sweep(c, "sawtooth", 320, 42, t, 1.1, 0.2);
      sweep(c, "sine", 240, 36, t + 0.02, 1.3, 0.16);
      burst(c, t, 1.0, 0.3, "lowpass", 2600, 0.9, 90);
    },

    setBoost(on: boolean): void {
      const c = live();
      if (!c) return;
      const t = c.ac.currentTime;
      c.boostGain.gain.cancelScheduledValues(t);
      c.boostGain.gain.setTargetAtTime(on ? 0.1 : 0, t, on ? 0.03 : 0.09);
      c.boostFilter.frequency.cancelScheduledValues(t);
      c.boostFilter.frequency.setTargetAtTime(on ? 900 : 380, t, 0.08);
    },

    ambient(on: boolean): void {
      const c = live();
      if (!c) return;
      c.droneGain.gain.setTargetAtTime(on ? 0.11 : 0, c.ac.currentTime, 0.6);
    },

    dispose(): void {
      disposed = true;
      if (ctx) {
        try {
          for (const n of ctx.nodes) {
            const s = n as AudioScheduledSourceNode;
            if (typeof s.stop === "function") s.stop();
          }
          void ctx.ac.close();
        } catch {
          /* closing an already-dead context is not an error */
        }
        ctx = null;
      }
    },
  };

  return api;
}
