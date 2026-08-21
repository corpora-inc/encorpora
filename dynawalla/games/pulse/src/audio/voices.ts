/**
 * Procedural voices. Every sound is transient + body + tail, and every one of them
 * carries a small random detune so a thousand hits never fatigue the ear.
 *
 * Nothing here reads game state; callers pass an absolute audio-clock time so the
 * lookahead scheduler can place events with sample accuracy.
 */

import type { Engine } from "./engine.ts";

const EPS = 0.0001;

function vary(r: number, cents: number): number {
  return Math.pow(2, ((Math.random() * 2 - 1) * cents) / 1200) * r;
}

function env(
  ctx: AudioContext,
  g: GainNode,
  at: number,
  peak: number,
  attack: number,
  decay: number,
  hold = 0,
): void {
  const p = g.gain;
  p.setValueAtTime(EPS, at);
  p.exponentialRampToValueAtTime(Math.max(EPS, peak), at + attack);
  if (hold > 0) p.setValueAtTime(Math.max(EPS, peak), at + attack + hold);
  p.exponentialRampToValueAtTime(EPS, at + attack + hold + decay);
}

function stopAt(nodes: AudioScheduledSourceNode[], t: number): void {
  for (const n of nodes) n.stop(t);
}

function send(e: Engine, node: AudioNode, amount: number): void {
  if (amount <= 0) return;
  const g = e.ctx.createGain();
  g.gain.value = amount;
  node.connect(g);
  g.connect(e.reverbSend);
}

export type Voices = ReturnType<typeof createVoices>;

export function createVoices(e: Engine) {
  const ctx = e.ctx;

  const noiseSource = (at: number, dur: number, playbackRate = 1): AudioBufferSourceNode => {
    const s = ctx.createBufferSource();
    s.buffer = e.noise;
    s.loop = true;
    s.playbackRate.value = playbackRate;
    s.start(at, Math.random() * 1.5, dur + 0.05);
    return s;
  };

  return {
    /** Sub-heavy kick: click transient, pitch-swept sine body, short tail. */
    kick(at: number, gain = 1): void {
      const g = ctx.createGain();
      g.connect(e.drumBus);
      const o = ctx.createOscillator();
      o.type = "sine";
      const f = o.frequency;
      f.setValueAtTime(vary(150, 40), at);
      f.exponentialRampToValueAtTime(vary(44, 25), at + 0.075);
      o.connect(g);
      env(ctx, g, at, 0.95 * gain, 0.003, 0.26);
      o.start(at);
      stopAt([o], at + 0.4);

      const cg = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1400;
      const n = noiseSource(at, 0.03);
      n.connect(hp);
      hp.connect(cg);
      cg.connect(e.drumBus);
      env(ctx, cg, at, 0.2 * gain, 0.001, 0.022);
      stopAt([n], at + 0.08);
    },

    /** Snare: bandpassed noise + a triangle body a fifth apart. */
    snare(at: number, gain = 1): void {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = vary(1850, 90);
      bp.Q.value = 0.7;
      const ng = ctx.createGain();
      const n = noiseSource(at, 0.2);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(e.drumBus);
      env(ctx, ng, at, 0.5 * gain, 0.002, 0.15);
      send(e, ng, 0.18);
      stopAt([n], at + 0.3);

      const bg = ctx.createGain();
      bg.connect(e.drumBus);
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.setValueAtTime(vary(196, 50), at);
      o.frequency.exponentialRampToValueAtTime(vary(150, 40), at + 0.1);
      o.connect(bg);
      env(ctx, bg, at, 0.3 * gain, 0.002, 0.1);
      o.start(at);
      stopAt([o], at + 0.25);
    },

    /** Hat. `open` stretches the tail; pitch wanders so a 16th roll stays alive. */
    hat(at: number, gain = 1, open = false): void {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = vary(7600, 140);
      const g = ctx.createGain();
      const dur = open ? 0.26 : 0.045;
      const n = noiseSource(at, dur + 0.05, vary(1, 200));
      n.connect(hp);
      hp.connect(g);
      g.connect(e.drumBus);
      env(ctx, g, at, (open ? 0.2 : 0.17) * gain, 0.001, dur);
      if (open) send(e, g, 0.14);
      stopAt([n], at + dur + 0.12);
    },

    clap(at: number, gain = 1): void {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = vary(1500, 80);
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      g.connect(e.drumBus);
      bp.connect(g);
      for (let i = 0; i < 3; i++) {
        const t = at + i * 0.011;
        const n = noiseSource(t, 0.03);
        n.connect(bp);
        stopAt([n], t + 0.05);
      }
      env(ctx, g, at, 0.42 * gain, 0.002, 0.19);
      send(e, g, 0.26);
    },

    tom(at: number, hz: number, gain = 1): void {
      const g = ctx.createGain();
      g.connect(e.drumBus);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(vary(hz * 1.5, 30), at);
      o.frequency.exponentialRampToValueAtTime(vary(hz, 30), at + 0.14);
      o.connect(g);
      env(ctx, g, at, 0.5 * gain, 0.003, 0.24);
      send(e, g, 0.2);
      o.start(at);
      stopAt([o], at + 0.4);
    },

    /** Bass: two detuned saws through an enveloped lowpass. */
    bass(at: number, hz: number, dur: number, gain = 1): void {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 7;
      lp.frequency.setValueAtTime(Math.min(6000, hz * 9), at);
      lp.frequency.exponentialRampToValueAtTime(Math.max(90, hz * 2.2), at + Math.min(0.22, dur));
      const g = ctx.createGain();
      lp.connect(g);
      g.connect(e.musicBus);
      const osc: OscillatorNode[] = [];
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz;
        o.detune.value = det;
        o.connect(lp);
        o.start(at);
        osc.push(o);
      }
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = hz / 2;
      const sg = ctx.createGain();
      sg.gain.value = 0.55;
      sub.connect(sg);
      sg.connect(lp);
      sub.start(at);
      osc.push(sub);
      env(ctx, g, at, 0.34 * gain, 0.006, Math.max(0.06, dur * 0.7), dur * 0.25);
      stopAt(osc, at + dur + 0.3);
    },

    /** The player's own voice: a bright pluck. Its pitch climbs with the combo. */
    pluck(at: number, hz: number, gain = 1, bright = 1): void {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(Math.min(15000, hz * 12 * bright), at);
      lp.frequency.exponentialRampToValueAtTime(Math.max(200, hz * 2), at + 0.16);
      const g = ctx.createGain();
      lp.connect(g);
      g.connect(e.musicBus);
      const osc: OscillatorNode[] = [];
      for (const [type, det, lvl] of [
        ["triangle", 0, 1],
        ["square", 9, 0.32],
        ["sawtooth", -11, 0.22],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = vary(hz, 5);
        o.detune.value = det;
        const og = ctx.createGain();
        og.gain.value = lvl;
        o.connect(og);
        og.connect(lp);
        o.start(at);
        osc.push(o);
      }
      env(ctx, g, at, 0.24 * gain, 0.003, 0.3);
      send(e, g, 0.28);
      stopAt(osc, at + 0.5);
    },

    /** A wide chord swell for phrase ends and the drop. */
    chord(at: number, hzs: readonly number[], dur: number, gain = 1): void {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(700, at);
      lp.frequency.linearRampToValueAtTime(5200, at + dur * 0.5);
      const g = ctx.createGain();
      lp.connect(g);
      g.connect(e.musicBus);
      const osc: OscillatorNode[] = [];
      for (const hz of hzs) {
        for (const det of [-9, 9]) {
          const o = ctx.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = hz;
          o.detune.value = det;
          const og = ctx.createGain();
          og.gain.value = 0.32;
          o.connect(og);
          og.connect(lp);
          o.start(at);
          osc.push(o);
        }
      }
      env(ctx, g, at, 0.2 * gain, 0.05, dur * 0.7, dur * 0.3);
      send(e, g, 0.5);
      stopAt(osc, at + dur + 0.9);
    },

    /** Big downbeat impact for a drop: sub thump + noise sweep + shimmer. */
    impact(at: number, gain = 1): void {
      const g = ctx.createGain();
      g.connect(e.fxBus);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(190, at);
      o.frequency.exponentialRampToValueAtTime(32, at + 0.4);
      o.connect(g);
      env(ctx, g, at, 1.0 * gain, 0.004, 0.7);
      send(e, g, 0.4);
      o.start(at);
      stopAt([o], at + 1.2);

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(5200, at);
      bp.frequency.exponentialRampToValueAtTime(280, at + 0.5);
      const ng = ctx.createGain();
      const n = noiseSource(at, 0.6);
      n.connect(bp);
      bp.connect(ng);
      ng.connect(e.fxBus);
      env(ctx, ng, at, 0.4 * gain, 0.003, 0.55);
      send(e, ng, 0.6);
      stopAt([n], at + 0.9);
    },

    /** Upward riser into a drop. */
    riser(at: number, dur: number, gain = 1): void {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.Q.value = 3.5;
      bp.frequency.setValueAtTime(260, at);
      bp.frequency.exponentialRampToValueAtTime(8200, at + dur);
      const g = ctx.createGain();
      const n = noiseSource(at, dur + 0.1);
      n.connect(bp);
      bp.connect(g);
      g.connect(e.fxBus);
      g.gain.setValueAtTime(EPS, at);
      g.gain.exponentialRampToValueAtTime(0.3 * gain, at + dur);
      g.gain.exponentialRampToValueAtTime(EPS, at + dur + 0.12);
      send(e, g, 0.4);
      stopAt([n], at + dur + 0.25);
    },

    /** A missed note: a dull, detuned thud. Wrong, not punitive. */
    thud(at: number, gain = 1): void {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      const g = ctx.createGain();
      lp.connect(g);
      g.connect(e.fxBus);
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(vary(120, 60), at);
      o.frequency.exponentialRampToValueAtTime(vary(72, 60), at + 0.12);
      o.connect(lp);
      env(ctx, g, at, 0.24 * gain, 0.004, 0.16);
      o.start(at);
      stopAt([o], at + 0.35);
    },

    /** A wrong gate answer: the band stumbles. */
    stumble(at: number, gain = 1): void {
      const g = ctx.createGain();
      g.connect(e.fxBus);
      const osc: OscillatorNode[] = [];
      for (const [hz, det] of [
        [116, 0],
        [123, 14],
      ] as const) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(hz, at);
        o.frequency.exponentialRampToValueAtTime(hz * 0.62, at + 0.34);
        o.detune.value = det;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(1400, at);
        lp.frequency.exponentialRampToValueAtTime(240, at + 0.3);
        o.connect(lp);
        lp.connect(g);
        o.start(at);
        osc.push(o);
      }
      env(ctx, g, at, 0.3 * gain, 0.005, 0.4);
      stopAt(osc, at + 0.7);
    },

    /** Tiny interface blip — menus, toggles, calibration taps. */
    blip(at: number, hz = 880, gain = 1): void {
      const g = ctx.createGain();
      g.connect(e.fxBus);
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = vary(hz, 8);
      o.connect(g);
      env(ctx, g, at, 0.12 * gain, 0.002, 0.06);
      o.start(at);
      stopAt([o], at + 0.12);
    },
  };
}
