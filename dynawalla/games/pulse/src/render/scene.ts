/**
 * The scene: a CRT vector display in a dark room.
 *
 * Everything is additive light on near-black — no fills, no cards, no gradients that
 * a design system would recognise. The frame is built in three passes:
 *
 *   1. background   — receding frame tunnel, dust, radial spectrum, oscilloscope
 *   2. trail buffer — half resolution, faded not cleared, so every glow smears into
 *                     phosphor persistence and the upscale *is* the bloom
 *   3. foreground   — the crisp grid, the notes, the numbers
 *
 * Camera transform (shake, punch, roll) wraps 1-3. The HUD sits outside it so the
 * score never becomes unreadable at the exact moment the score changes.
 */

import { safeRect } from "../../../../packs/shared/game-chrome/index.ts";
import { BEATS_PER_BAR } from "../game/chart.ts";
import { WINDOWS, type Judgment, type LiveNote } from "../game/judge.ts";
import type { Run } from "../game/run.ts";
import type { StageSpec } from "../game/stages.ts";
import type { BuiltGate } from "../game/gate.ts";
import type { GateOutcome } from "../game/run.ts";
import { clamp01, impulse, lerp, outBack, outCubic, outExpo, outQuint, approach } from "../juice/ease.ts";
import { FlashGovernor } from "../juice/flash.ts";
import { Hitstop } from "../juice/hitstop.ts";
import { Shake } from "../juice/shake.ts";
import type { Surfaces } from "./canvas.ts";
import { glow, halo, warmGlow } from "./glow.ts";
import {
  comboBox,
  computeLayout,
  healthBox,
  multBox,
  promptBox,
  scoreBox,
  stageBox,
  type Layout,
} from "./layout.ts";
import { BG_RGB, INK, JUDGE_INK, laneInk, rgb, type Ink } from "./palette.ts";
import { KIND_MOTE, KIND_SHARD, Particles, Ripples } from "./particles.ts";
import { fraction, fractionBar, measure, neon, setFont } from "./text.ts";

type Popup = {
  x: number;
  y: number;
  vy: number;
  t: number;
  dur: number;
  text: string;
  ink: Ink;
  size: number;
};

type Dust = { x: number; y: number; z: number; s: number };

export type SceneOptions = {
  reducedMotion: () => boolean;
  /** Lower budgets on phones. */
  lowPower?: boolean;
};

const FRACTION_TOKEN = /^(-?\d+)\/(\d+)$/;
const WINDOW_GOOD_SEC = WINDOWS.good;
const WINDOW_PERFECT_SEC = WINDOWS.perfect;

export class Scene {
  layout: Layout;
  readonly particles: Particles;
  readonly ripples = new Ripples();
  readonly shake: Shake;
  readonly flash: FlashGovernor;
  readonly hitstop = new Hitstop();

  private popups: Popup[] = [];
  private dust: Dust[] = [];
  private displayScore = 0;
  private comboPunch = 0;
  private multPunch = 0;
  private zoom = 1;
  private roll = 0;
  private chroma = 0;
  private stageCard: { stage: StageSpec; index: number; t: number } | null = null;
  private gateGlow = 0;
  private gateBanner: { text: string; ink: Ink; t: number } | null = null;
  private overdriveGlow = 0;
  private stumbleGlow = 0;
  private beatFlashT = 1;
  private lastBeatSeen = -1;
  private laneHit: number[] = [0, 0, 0];
  private strikePulse = 0;
  private lowHealthPhase = 0;
  private time = 0;
  private frameCost = 0;

  private readonly s: Surfaces;
  private readonly opts: SceneOptions;

  constructor(s: Surfaces, opts: SceneOptions) {
    this.s = s;
    this.opts = opts;
    warmGlow();
    this.particles = new Particles(opts.lowPower ? 520 : 900);
    this.shake = new Shake(2.05, 7);
    this.flash = new FlashGovernor(opts.reducedMotion);
    this.layout = computeLayout(s.w, s.h, 3, safeRect(s.w, s.h));
    this.seedDust();
  }

  private seedDust(): void {
    const n = this.opts.lowPower ? 54 : 110;
    this.dust = [];
    for (let i = 0; i < n; i++) {
      this.dust.push({
        x: Math.random(),
        y: Math.random(),
        z: 0.25 + Math.random() * 0.75,
        s: 0.6 + Math.random() * 1.8,
      });
    }
  }

  /**
   * Re-measures the safe area every time, so a rotation or an iPad Split View
   * resize relays out against the new insets rather than the mount-time ones.
   */
  resize(laneCount: number): void {
    const { w, h } = this.s;
    this.layout = computeLayout(w, h, Math.max(1, laneCount), safeRect(w, h));
  }

  // ------------------------------------------------------------------ fx in

  hitBurst(note: LiveNote, judgment: Judgment, combo: number, laneCount: number, nowBeat: number): void {
    const reduced = this.opts.reducedMotion();
    const u = (note.beat - nowBeat) / BEATS_PER_BAR;
    const p = this.layout.pt(Math.max(0, Math.min(0.06, u)), this.layout.laneV(Math.min(note.lane, laneCount - 1)));
    const ink = judgment === "perfect" ? "lime" : laneInk(note.lane, laneCount);
    const heavy = judgment === "perfect";
    note.pop = 1;

    const n = reduced ? (heavy ? 6 : 3) : heavy ? 26 : judgment === "great" ? 15 : 9;
    const along = this.layout.along;
    this.particles.emit(p.x, p.y, {
      ink,
      count: n,
      speed: heavy ? 520 : 330,
      life: heavy ? 0.5 : 0.34,
      size: heavy ? 2.6 : 2,
      drag: 3.4,
      spread: Math.PI * 2,
    });
    if (!reduced) {
      this.particles.emit(p.x, p.y, {
        ink: "white",
        count: heavy ? 8 : 4,
        speed: 700,
        life: 0.22,
        drag: 6,
        angle: Math.atan2(-along.y, -along.x),
        spread: 1.0,
      });
      if (heavy) {
        this.particles.emit(p.x, p.y, {
          ink,
          count: 6,
          speed: 210,
          life: 0.7,
          size: 5,
          drag: 1.6,
          kind: KIND_MOTE,
        });
      }
    }
    this.ripples.add(p.x, p.y, this.noteRadius() * 0.7, this.noteRadius() * (heavy ? 5.2 : 3.2), heavy ? 0.44 : 0.3, ink, heavy ? 1.4 : 1);
    this.shake.add(reduced ? 0 : heavy ? 0.19 : judgment === "great" ? 0.11 : 0.06);
    this.hitstop.hit(heavy ? 34 : 14, heavy ? 0.08 : 0.35);
    this.laneHit[note.lane] = 1;
    this.strikePulse = Math.min(1.6, this.strikePulse + (heavy ? 0.9 : 0.55));
    this.comboPunch = 1;
    this.popup(p.x, p.y, judgment.toUpperCase(), JUDGE_INK[judgment], heavy ? 22 : 17);
    if (combo > 0 && combo % 25 === 0) {
      this.flash.request(this.time, 0.6);
      this.shake.add(reduced ? 0 : 0.3);
    }
  }

  missPulse(note: LiveNote, laneCount: number, nowBeat: number): void {
    const u = (note.beat - nowBeat) / BEATS_PER_BAR;
    const p = this.layout.pt(Math.max(-0.2, Math.min(0.06, u)), this.layout.laneV(Math.min(note.lane, laneCount - 1)));
    note.pop = 1;
    this.ripples.add(p.x, p.y, this.noteRadius() * 1.4, this.noteRadius() * 0.4, 0.3, "rose", 0.8);
    if (!this.opts.reducedMotion()) {
      this.particles.emit(p.x, p.y, {
        ink: "rose",
        count: 5,
        speed: 120,
        life: 0.4,
        drag: 4,
        grav: 620,
        kind: KIND_SHARD,
        size: 3,
      });
    }
    this.popup(p.x, p.y, "MISS", "rose", 15);
    this.comboPunch = 0;
  }

  strayPulse(lane: number): void {
    this.laneHit[lane] = Math.max(this.laneHit[lane] ?? 0, 0.35);
  }

  gateOpen(_g: BuiltGate): void {
    this.gateGlow = 1;
  }

  gateResolved(outcome: GateOutcome, note: LiveNote | null, _g: BuiltGate, laneCount: number, nowBeat: number): void {
    const reduced = this.opts.reducedMotion();
    if (outcome === "correct" && note) {
      const u = (note.beat - nowBeat) / BEATS_PER_BAR;
      const p = this.layout.pt(Math.max(0, Math.min(0.06, u)), this.layout.laneV(Math.min(note.lane, laneCount - 1)));
      this.flash.request(this.time, 1);
      this.shake.add(reduced ? 0 : 0.62);
      this.hitstop.hit(reduced ? 20 : 90, 0.05);
      this.zoom = 1.085;
      this.roll = (Math.random() - 0.5) * 0.016;
      this.chroma = 1;
      for (const ink of ["lime", "cyan", "white"] as const) {
        this.particles.emit(p.x, p.y, {
          ink,
          count: reduced ? 8 : 42,
          speed: 900,
          life: 0.75,
          size: 3,
          drag: 2.6,
        });
      }
      this.particles.emit(p.x, p.y, {
        ink: "lime",
        count: reduced ? 3 : 14,
        speed: 300,
        life: 1.1,
        size: 8,
        drag: 1.3,
        kind: KIND_MOTE,
      });
      this.ripples.add(p.x, p.y, 8, Math.max(this.s.w, this.s.h) * 0.95, 0.72, "lime", 2.2);
      this.ripples.add(p.x, p.y, 8, Math.max(this.s.w, this.s.h) * 0.6, 0.5, "white", 1.4);
      this.gateBanner = { text: "SOLVED", ink: "lime", t: 0 };
    } else {
      this.shake.add(reduced ? 0 : 0.42);
      this.hitstop.hit(reduced ? 16 : 120, 0.12);
      this.chroma = 0.85;
      this.stumbleGlow = 1;
      this.gateBanner = { text: outcome === "wrong" ? "OFF" : "GONE", ink: "rose", t: 0 };
      if (note) {
        const u = (note.beat - nowBeat) / BEATS_PER_BAR;
        const p = this.layout.pt(Math.max(0, Math.min(0.06, u)), this.layout.laneV(Math.min(note.lane, laneCount - 1)));
        this.particles.emit(p.x, p.y, {
          ink: "rose",
          count: reduced ? 6 : 26,
          speed: 320,
          life: 0.8,
          size: 3,
          drag: 2.2,
          grav: 900,
          kind: KIND_SHARD,
        });
      }
    }
    this.gateGlow = 0;
  }

  onBar(_bar: number): void {
    this.zoom = Math.max(this.zoom, 1.012);
  }

  stageCardShow(stage: StageSpec, index: number): void {
    this.stageCard = { stage, index, t: 0 };
    this.zoom = Math.max(this.zoom, 1.05);
    this.shake.add(this.opts.reducedMotion() ? 0 : 0.28);
  }

  dropFlash(): void {
    this.flash.request(this.time, 0.85);
    this.shake.add(this.opts.reducedMotion() ? 0 : 0.5);
    this.zoom = Math.max(this.zoom, 1.07);
    this.chroma = Math.max(this.chroma, 0.9);
    const c = this.layout.pt(0.5, 0.5);
    this.ripples.add(c.x, c.y, 10, Math.max(this.s.w, this.s.h), 0.85, "violet", 2);
    if (!this.opts.reducedMotion()) {
      this.particles.emit(c.x, c.y, { ink: "violet", count: 40, speed: 800, life: 0.9, drag: 2, size: 3 });
    }
  }

  stumbleShow(): void {
    this.stumbleGlow = 1.4;
    this.shake.add(this.opts.reducedMotion() ? 0 : 0.8);
    this.chroma = 1;
    this.gateBanner = { text: "REGROUP", ink: "rose", t: 0 };
  }

  overdriveSet(on: boolean): void {
    this.overdriveGlow = on ? 1 : 0;
    if (on) {
      this.gateBanner = { text: "OVERDRIVE", ink: "violet", t: 0 };
      this.flash.request(this.time, 1);
    }
  }

  layerBanner(name: string): void {
    this.gateBanner = { text: name.toUpperCase(), ink: "cyan", t: 0 };
  }

  private popup(x: number, y: number, text: string, ink: Ink, size: number): void {
    if (this.popups.length > 22) this.popups.shift();
    this.popups.push({ x, y, vy: -68, t: 0, dur: 0.62, text, ink, size });
  }

  private noteRadius(): number {
    return this.layout.noteR;
  }

  // ------------------------------------------------------------------- frame

  /** @returns milliseconds spent inside draw, for the perf overlay. */
  draw(run: Run, dtRaw: number): number {
    const t0 = performance.now();
    const reduced = this.opts.reducedMotion();
    /**
     * A stalled frame (a tab switch, a garbage-collection hitch, a throttled
     * background tab) must not be replayed as a fifth of a second of simulation:
     * particles would survive forever, the pool would fill, and the trail buffer
     * would saturate. Above 120 ms we advance the effects clock by one nominal frame
     * and wipe the trail instead.
     */
    const stalled = dtRaw > 0.12;
    const dtReal = stalled ? 1 / 60 : dtRaw;
    if (stalled) {
      this.s.tctx.setTransform(this.s.tscale, 0, 0, this.s.tscale, 0, 0);
      this.s.tctx.globalCompositeOperation = "copy";
      this.s.tctx.clearRect(0, 0, this.s.w, this.s.h);
      this.particles.clear();
      this.ripples.clear();
    }
    this.time += dtReal;
    const dt = this.hitstop.step(dtReal);

    const nowBeat = run.nowBeat();
    const beatFrac = nowBeat - Math.floor(nowBeat);
    const beatIdx = Math.floor(nowBeat);
    if (beatIdx !== this.lastBeatSeen) {
      this.lastBeatSeen = beatIdx;
      this.beatFlashT = 0;
    }
    this.beatFlashT = Math.min(1, this.beatFlashT + dtReal * 3.4);
    const beatPulse = Math.pow(1 - clamp01(this.beatFlashT), 2.2);

    // --- simulation of effects
    this.particles.update(dt);
    this.ripples.update(dt);
    this.shake.update(dtReal, reduced ? 0 : this.layout.compact ? 9 : 15, reduced ? 0 : 0.012);
    this.flash.update(dtReal);
    this.zoom = approach(this.zoom, 1, 7.5, dtReal);
    this.roll = approach(this.roll, 0, 6, dtReal);
    this.chroma = approach(this.chroma, 0, 5.2, dtReal);
    this.gateGlow = approach(this.gateGlow, run.gate && !run.gate.resolved ? 1 : 0, 6, dtReal);
    this.stumbleGlow = Math.max(0, this.stumbleGlow - dtReal * 1.4);
    this.strikePulse = approach(this.strikePulse, 0, 7, dtReal);
    this.comboPunch = Math.max(0, this.comboPunch - dtReal * 3.6);
    this.multPunch = Math.max(0, this.multPunch - dtReal * 2.6);
    this.lowHealthPhase += dtReal * (run.health < 0.3 ? 2.4 : 0);
    for (let i = 0; i < this.laneHit.length; i++) {
      this.laneHit[i] = Math.max(0, (this.laneHit[i] ?? 0) - dtReal * 4.2);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i]!;
      p.t += dt;
      p.y += p.vy * dt;
      p.vy *= Math.exp(-4 * dt);
      if (p.t >= p.dur) this.popups.splice(i, 1);
    }
    if (this.stageCard) {
      this.stageCard.t += dtReal;
      if (this.stageCard.t > 2.6) this.stageCard = null;
    }
    if (this.gateBanner) {
      this.gateBanner.t += dtReal;
      if (this.gateBanner.t > 1.5) this.gateBanner = null;
    }
    this.displayScore = approach(this.displayScore, run.score, 9, dtReal);
    for (const n of run.notes.all()) if (n.pop > 0) n.pop = Math.max(0, n.pop - dtReal / 0.3);

    const { ctx, w, h } = this.s;
    const laneCount = this.layout.laneCount;

    // --- 1. background, in screen space (no camera): the vignette must not move.
    ctx.setTransform(this.s.dpr, 0, 0, this.s.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgb(${BG_RGB[0]},${BG_RGB[1]},${BG_RGB[2]})`;
    ctx.fillRect(0, 0, w, h);
    this.drawVignette(run, beatPulse);

    // --- camera
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx + this.shake.x, cy + this.shake.y);
    ctx.rotate(this.shake.rot + this.roll);
    const z = this.zoom * (1 + beatPulse * (reduced ? 0.002 : 0.006));
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);

    ctx.globalCompositeOperation = "lighter";
    this.drawDust(dt, beatPulse);
    this.drawTunnel(beatPulse, run);
    this.drawSpectrum(run, beatPulse);
    this.drawScope(run);

    // --- 2. trail buffer
    this.paintTrail(run, nowBeat, dt);
    this.compositeTrail(ctx, reduced);

    // --- 3. crisp foreground
    ctx.globalCompositeOperation = "lighter";
    this.drawGrid(run, nowBeat, beatFrac);
    this.drawStrike(run, beatPulse);
    this.drawNotes(run, nowBeat, false);
    this.drawGatePrompt(run);
    this.drawPopups();
    ctx.restore();

    // --- HUD outside the camera
    ctx.globalCompositeOperation = "lighter";
    this.drawHud(run);
    this.drawStageCard();
    this.drawBanner();

    ctx.globalCompositeOperation = "source-over";
    const flashLevel = this.flash.level;
    if (flashLevel > 0.001) {
      ctx.fillStyle = `rgba(210,235,255,${flashLevel.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    this.frameCost = performance.now() - t0;
    return this.frameCost;
  }

  // -------------------------------------------------------------- background

  private drawVignette(run: Run, beatPulse: number): void {
    const { ctx, w, h } = this.s;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    const danger = run.health < 0.34 ? (0.34 - run.health) / 0.34 : 0;
    const pulse = danger * (0.5 + 0.5 * Math.sin(this.lowHealthPhase));
    const od = this.overdriveGlow;
    const r = Math.round(10 + pulse * 40 + od * 24);
    const gg = Math.round(12 + od * 6 + beatPulse * 3);
    const b = Math.round(26 + od * 40 + beatPulse * 5);
    g.addColorStop(0, `rgba(${r},${gg},${b},${(0.55 + beatPulse * 0.12).toFixed(3)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private drawDust(dt: number, beatPulse: number): void {
    const { ctx, w, h } = this.s;
    ctx.beginPath();
    for (const d of this.dust) {
      d.x -= dt * 0.012 * d.z;
      if (d.x < -0.02) {
        d.x = 1.02;
        d.y = Math.random();
      }
      const x = d.x * w;
      const y = d.y * h;
      const r = d.s * (0.6 + beatPulse * 0.7) * d.z;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = `rgba(120,180,255,${(0.1 + beatPulse * 0.08).toFixed(3)})`;
    ctx.fill();
  }

  /** Concentric echoes of the playfield frame receding into the dark. */
  private drawTunnel(beatPulse: number, run: Run): void {
    const { ctx, w, h } = this.s;
    const l = this.layout;
    const a = l.pt(l.uMin, 0);
    const b = l.pt(l.uMax, 1);
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const fw = Math.abs(b.x - a.x);
    const fh = Math.abs(b.y - a.y);
    const cx = x0 + fw / 2;
    const cy = y0 + fh / 2;
    const layers = this.opts.lowPower ? 4 : 7;
    const od = this.overdriveGlow;
    for (let i = layers; i >= 1; i--) {
      const s = 1 + i * 0.15 + beatPulse * 0.024 * i;
      const alpha = (0.3 / i) * (1 + beatPulse * 0.9) * (1 + od * 1.4);
      const ink = od > 0.5 ? INK.violet : run.health < 0.3 ? INK.rose : INK.cyan;
      ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${alpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - (fw * s) / 2, cy - (fh * s) / 2, fw * s, fh * s);
    }
    void w;
    void h;
  }

  /**
   * The spectrum, growing outward from both edges of the playfield.
   *
   * This was a ring centred on the strike point, which sits at 19% of the width — so
   * three quarters of the ring fell off screen and the visible quarter read as a
   * stray arc. Framing the field instead fills the space above and below it, keeps
   * the eye where the notes are, and makes the whole layout breathe with the music.
   */
  private drawSpectrum(run: Run, beatPulse: number): void {
    const { ctx } = this.s;
    const sp = run.engine.spectrum;
    if (sp.length === 0) return;
    const l = this.layout;
    const bins = this.opts.lowPower ? 40 : 72;
    const od = this.overdriveGlow;
    const reach = l.orient === "h" ? (this.s.h - l.fieldThickness) * 0.42 : (this.s.w - l.fieldThickness) * 0.42;
    const span = l.orient === "h" ? this.s.w : this.s.h;
    const ax = l.across;
    ctx.lineWidth = Math.max(2, (span / bins) * 0.42);
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (let i = 0; i < bins; i++) {
      const v = (sp[Math.floor(Math.pow(i / bins, 1.35) * sp.length * 0.72)] ?? 0) / 255;
      const len = Math.pow(v, 1.7) * reach * (1 + od * 0.5) + 1;
      const t = (i + 0.5) / bins;
      for (const [edge, dir] of [
        [0, -1],
        [1, 1],
      ] as const) {
        const base = l.orient === "h" ? { x: t * span, y: l.pt(0, edge).y } : { x: l.pt(0, edge).x, y: t * span };
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(base.x + ax.x * dir * len, base.y + ax.y * dir * len);
      }
    }
    const ink = od > 0.5 ? INK.violet : INK.cyan;
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},${(0.16 + beatPulse * 0.1).toFixed(3)})`;
    ctx.stroke();
  }

  /** The literal waveform of the master bus. */
  private drawScope(run: Run): void {
    const { ctx, w, h } = this.s;
    const wave = run.engine.wave;
    if (wave.length === 0) return;
    const l = this.layout;
    const step = this.opts.lowPower ? 6 : 3;
    const drawOne = (yc: number, amp: number, alpha: number, ink: Ink): void => {
      ctx.beginPath();
      for (let i = 0; i < wave.length; i += step) {
        const x = (i / (wave.length - 1)) * w;
        const y = yc + (wave[i] ?? 0) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const c = INK[ink];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };
    if (l.orient === "h") {
      drawOne(h * 0.915, h * 0.062, 0.5, "cyan");
      drawOne(h * 0.085, h * 0.042, 0.2, "magenta");
    } else {
      drawOne(h * 0.945, h * 0.032, 0.45, "cyan");
      drawOne(h * 0.055, h * 0.024, 0.18, "magenta");
    }
  }

  // ------------------------------------------------------------------ trails

  private paintTrail(run: Run, nowBeat: number, dt: number): void {
    const { tctx, w, h } = this.s;
    tctx.setTransform(this.s.tscale, 0, 0, this.s.tscale, 0, 0);
    /**
     * Phosphor decay by REMOVING alpha, not by painting the background over it.
     * Painting `rgba(bg, a)` in source-over drives the buffer's alpha toward 1 and
     * its colour toward the background, and compositing that with `lighter` then
     * lifts the whole screen — which is how the first build washed out to lavender.
     * `destination-out` only ever takes light away.
     *
     * The rate is time-based, so a stalled frame fades proportionally instead of
     * letting a decade of glow pile up behind one 0.3 wipe.
     */
    const decay = 1 - Math.exp(-21 * dt);
    tctx.globalCompositeOperation = "destination-out";
    tctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0.02, decay)).toFixed(3)})`;
    tctx.fillRect(0, 0, w, h);
    tctx.globalCompositeOperation = "lighter";
    this.particles.draw(tctx, this.opts.reducedMotion() ? 0.2 : 1);
    this.ripples.draw(tctx);
    this.drawNotes(run, nowBeat, true);
  }

  private compositeTrail(ctx: CanvasRenderingContext2D, reduced: boolean): void {
    const { trail, w, h } = this.s;
    ctx.globalCompositeOperation = "lighter";
    const ch = reduced ? 0 : this.chroma;
    if (ch > 0.06) {
      // Real RGB split: tint two silhouettes of the trail buffer and offset them.
      const d = ch * (this.layout.compact ? 5 : 9);
      const tint = (dst: CanvasRenderingContext2D, colour: string): void => {
        dst.setTransform(1, 0, 0, 1, 0, 0);
        dst.globalCompositeOperation = "copy";
        dst.drawImage(trail, 0, 0);
        dst.globalCompositeOperation = "source-in";
        dst.fillStyle = colour;
        dst.fillRect(0, 0, trail.width, trail.height);
      };
      tint(this.s.sctxA, "#ff3050");
      tint(this.s.sctxB, "#30d8ff");
      ctx.globalAlpha = 0.62;
      ctx.drawImage(this.s.scratchA, -d, 0, w, h);
      ctx.drawImage(this.s.scratchB, d, 0, w, h);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(trail, 0, 0, w, h);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(trail, 0, 0, w, h);
    }
  }

  // -------------------------------------------------------------------- grid

  private drawGrid(run: Run, nowBeat: number, _beatFrac: number): void {
    const { ctx } = this.s;
    const l = this.layout;
    const tickDiv = run.stage.tickDiv;
    const first = Math.floor(nowBeat + l.uMin * BEATS_PER_BAR);
    const last = Math.ceil(nowBeat + l.uMax * BEATS_PER_BAR);
    // Imminent, not merely open: the question now appears several seconds
    // ahead of the bar it lands on, and the floor must not sit dimmed for all of
    // it — the child is still playing notes while they read.
    const gate = run.gateImminent() ? 1 : 0;
    const dim = 1 - gate * 0.45;

    // Lane rails: each lane is a track, not a row of floating things.
    ctx.beginPath();
    for (let i = 0; i < l.laneCount; i++) {
      const v = l.laneV(i);
      const a = l.pt(l.uMin, v);
      const b = l.pt(l.uMax, v);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = `rgba(90,150,200,${(0.14 * dim).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Field edges.
    ctx.beginPath();
    for (const v of [0, 1]) {
      const a = l.pt(l.uMin, v);
      const b = l.pt(l.uMax, v);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.strokeStyle = `rgba(120,190,235,${(0.26 * dim).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Subdivision lines.
    if (tickDiv > 1) {
      ctx.beginPath();
      for (let b = first; b <= last; b++) {
        for (let k = 1; k < tickDiv; k++) {
          const beat = b + k / tickDiv;
          const u = (beat - nowBeat) / BEATS_PER_BAR;
          if (u < l.uMin || u > l.uMax) continue;
          const a = l.pt(u, 0);
          const bpt = l.pt(u, 1);
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bpt.x, bpt.y);
        }
      }
      ctx.strokeStyle = `rgba(80,140,190,${(0.13 * dim).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Beat lines + the fraction they sit at inside the bar.
    const labelSize = l.compact ? 9 : 11;
    for (let b = first; b <= last; b++) {
      const u = (b - nowBeat) / BEATS_PER_BAR;
      if (u < l.uMin || u > l.uMax) continue;
      const isBar = ((b % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0;
      const a = l.pt(u, 0);
      const c = l.pt(u, 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.strokeStyle = isBar
        ? `rgba(150,215,255,${(0.5 * dim).toFixed(3)})`
        : `rgba(90,160,210,${(0.24 * dim).toFixed(3)})`;
      ctx.lineWidth = isBar ? 2 : 1;
      ctx.stroke();

      const lp = l.pt(u, 1);
      const lx = lp.x + l.across.x * (l.compact ? 15 : 20);
      const ly = lp.y + l.across.y * (l.compact ? 15 : 20);
      const k = ((b % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
      if (isBar) {
        neon(ctx, "1", lx, ly, labelSize * 1.5, "white", { alpha: 0.55 * dim, bloom: 0.4 });
      } else {
        fraction(ctx, k, BEATS_PER_BAR, lx, ly, labelSize, "cyan", 0.4 * dim);
      }
    }
  }

  private drawStrike(run: Run, beatPulse: number): void {
    const { ctx } = this.s;
    const l = this.layout;
    const a = l.strikeA;
    const b = l.strikeB;
    const pulse = this.strikePulse;
    const gate = this.gateGlow;

    // The timing window, drawn to scale. A player can literally see how much room
    // they have, and it visibly narrows as the tempo climbs.
    const spb = run.timeline.spbAtBeat(run.nowBeat());
    const uWin = WINDOW_GOOD_SEC / spb / BEATS_PER_BAR;
    const uPerf = WINDOW_PERFECT_SEC / spb / BEATS_PER_BAR;
    for (const [u, alpha] of [
      [uWin, 0.05],
      [uPerf, 0.09],
    ] as const) {
      const p0 = l.pt(-u, 0);
      const p1 = l.pt(u, 1);
      ctx.fillStyle = `rgba(120,220,255,${(alpha * (1 + pulse)).toFixed(3)})`;
      ctx.fillRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
    }

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(235,250,255,${(0.5 + pulse * 0.45 + beatPulse * 0.16).toFixed(3)})`;
    ctx.lineWidth = 2 + pulse * 3;
    ctx.stroke();

    const mid = l.pt(0, 0.5);
    glow(ctx, gate > 0.3 ? "lime" : "white", mid.x, mid.y, l.fieldThickness * (0.5 + pulse * 0.35), 0.16 + pulse * 0.3 + gate * 0.2);

    // Per-lane strike markers: a diamond that squashes when its lane is struck.
    const r = this.noteRadius();
    for (let i = 0; i < l.laneCount; i++) {
      const p = l.pt(0, l.laneV(i));
      const hit = this.laneHit[i] ?? 0;
      const ink = laneInk(i, l.laneCount);
      const sx = 1 + hit * 0.85;
      const sy = 1 - hit * 0.4;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (l.orient === "h") ctx.scale(sy, sx);
      else ctx.scale(sx, sy);
      ctx.rotate(Math.PI / 4);
      const c = INK[ink];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(0.55 + hit * 0.45).toFixed(3)})`;
      ctx.lineWidth = 2;
      const s = r * 0.72;
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      if (hit > 0.02) glow(ctx, ink, p.x, p.y, r * (1.4 + hit * 2.2), hit * 0.55);
    }
    void run;
  }

  // ------------------------------------------------------------------- notes

  private drawNotes(run: Run, nowBeat: number, toTrail: boolean): void {
    const ctx = toTrail ? this.s.tctx : this.s.ctx;
    const l = this.layout;
    const laneCount = l.laneCount;
    const r = this.noteRadius();
    const gateDim = run.gateImminent() ? 0.35 : 1;

    for (const n of run.notes.all()) {
      const u = (n.beat - nowBeat) / BEATS_PER_BAR;
      if (u > l.uMax || u < l.uMin) continue;
      const judged = n.judged !== null;
      if (judged && n.pop <= 0) continue;
      const lane = Math.min(n.lane, laneCount - 1);
      const p = l.pt(u, l.laneV(lane));
      const isGate = n.gate !== undefined;
      const ink: Ink = isGate ? "violet" : laneInk(lane, laneCount);

      // Fade in at the far edge so nothing pops into existence.
      const enter = clamp01((1.04 - u) / 0.12);
      let alpha = enter * (isGate ? 1 : gateDim);
      let scale = 1 + (n.accent ? 0.16 : 0);
      if (judged) {
        const k = n.pop;
        if (n.judged === "miss") {
          alpha *= k * 0.5;
          scale *= 0.6 + k * 0.4;
        } else {
          alpha *= k;
          scale *= 1 + (1 - k) * 1.7; // outward pop
        }
      }
      if (alpha <= 0.01) continue;

      const rr = (isGate ? l.gateR : r) * scale;
      if (toTrail) {
        glow(ctx, ink, p.x, p.y, rr * 2.1, alpha * (isGate ? 0.5 : 0.34));
        continue;
      }

      glow(ctx, ink, p.x, p.y, rr * 1.6, alpha * 0.42);
      const c = INK[ink];
      ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
      ctx.lineWidth = isGate ? 2.5 : n.accent ? 2.4 : 1.8;
      shape(ctx, n.div, p.x, p.y, rr, isGate);

      if (isGate) {
        const g = n.gate!;
        const m = FRACTION_TOKEN.exec(g.label);
        const inner = rr * 0.62;
        if (m) {
          fraction(ctx, Number(m[1]), Number(m[2]), p.x, p.y - inner * 0.06, inner * 0.84, "white", alpha);
          fractionBar(
            ctx,
            Number(m[1]),
            Number(m[2]),
            p.x - rr * 0.72,
            p.y + rr * (l.compact ? 0.72 : 0.78),
            rr * 1.44,
            l.compact ? 5 : 7,
            "violet",
            alpha * 0.9,
          );
        } else {
          neon(ctx, g.label, p.x, p.y, inner, "white", { alpha });
        }
      }
    }
  }

  /**
   * The question. It used to sit at `h * 0.075` in portrait — 42.6px on a 568px
   * phone, which is inside the host's two corner squares and under the notch on
   * anything with one. It is the single most important readable in the game, so
   * it now lives in a band the layout reserves for it, below both corners, with
   * the note run starting below IT in turn.
   */
  private drawGatePrompt(run: Run): void {
    const g = run.gate;
    if (!g) return;
    const k = this.gateGlow;
    if (k <= 0.02) return;
    const { ctx } = this.s;
    const l = this.layout;
    const size = l.hud.prompt.size;
    const box = promptBox(l, promptWidth(ctx, g.built.prompt, size));
    const grow = outBack(clamp01(k * 1.4)) * k;
    ctx.save();
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.scale(0.86 + grow * 0.14, 0.86 + grow * 0.14);
    drawPromptTokens(ctx, g.built.prompt, 0, 0, size, k);
    ctx.restore();
  }

  private drawPopups(): void {
    const { ctx } = this.s;
    for (const p of this.popups) {
      const k = 1 - p.t / p.dur;
      const a = k * k;
      const s = p.size * (1 + (1 - k) * 0.35);
      neon(ctx, p.text, p.x, p.y, s, p.ink, { alpha: a, bloom: 0.8 });
    }
  }

  // --------------------------------------------------------------------- hud

  /**
   * Every readable here is drawn FROM a box the layout owns, and the layout puts
   * those boxes clear of the host's two 44px corners and inside the safe rect.
   * Before this, at 320×568, the score sat at y 14..40 and the health bar at
   * x 14..124 / y 48..53 — both inside the exit button's square (10..54, 13..57),
   * and the multiplier was under the how-to-play button on the other side.
   */
  private drawHud(run: Run): void {
    const { ctx } = this.s;
    const l = this.layout;
    const hud = l.hud;

    // Score, monospaced so the digits never dance.
    const score = Math.round(this.displayScore).toLocaleString("en-US");
    const sb = scoreBox(l, measure(ctx, score, hud.score.size, true));
    neon(ctx, score, sb.x, sb.y + sb.h / 2, hud.score.size, "white", {
      align: "left",
      mono: true,
      alpha: 0.95,
    });

    // Multiplier. Its box is reserved at the PUNCHED size, because it swells at
    // the exact moment it changes, and it swells beside the host's help button.
    const mult = run.multiplier();
    const mtxt = `×${mult}`;
    const msize = hud.score.size * (0.8 + this.multPunch * 0.5);
    const mink: Ink = run.overdriveActive() ? "violet" : mult >= 4 ? "lime" : "cyan";
    const mb = multBox(l, measure(ctx, mtxt, hud.mult.size, true));
    neon(ctx, mtxt, mb.x + mb.w, mb.y + mb.h / 2, msize, mink, {
      align: "right",
      mono: true,
      alpha: 0.95,
    });

    // Combo, near the strike line where the eye already is.
    if (run.combo >= 3) {
      const ctext = String(run.combo);
      const cs = hud.combo.size * (1 + this.comboPunch * 0.28);
      const cb = comboBox(l, measure(ctx, ctext, hud.combo.size, true));
      neon(ctx, ctext, cb.x + cb.w / 2, cb.y + cb.h / 2, cs, run.combo >= 25 ? "lime" : "white", {
        align: "center",
        mono: true,
        alpha: 0.5 + Math.min(0.5, run.combo / 60),
      });
    }

    // Health: segmented, plus a label so it is not colour alone.
    const segs = 10;
    const hb = healthBox(l);
    const filled = Math.ceil(run.health * segs - 0.0001);
    for (let i = 0; i < segs; i++) {
      const cw = hb.w / segs;
      const on = i < filled;
      const ink: Ink = run.health < 0.3 ? "rose" : run.health < 0.6 ? "amber" : "cyan";
      const c = INK[ink];
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${on ? 0.75 : 0.09})`;
      ctx.fillRect(hb.x + i * cw, hb.y, cw - 2, hb.h);
    }

    // Stage strip: the subdivision you are currently living in, and the stage's
    // note value drawn as the fraction it is.
    const title = run.stage.title;
    const tsize = hud.stage.size;
    const gsize = hud.stage.glyphSize;
    const titleW = measure(ctx, title, tsize);
    const glyphGap = l.compact ? 12 : 16;
    const stb = stageBox(l, titleW + glyphGap + glyphChainWidth(ctx, run.stage.glyph, gsize));
    const scy = stb.y + stb.h / 2;
    neon(ctx, title, stb.x, scy, tsize, "cyan", { align: "left", alpha: 0.55 });
    drawGlyphChain(ctx, run.stage.glyph, stb.x + titleW + glyphGap, scy, gsize, 0.6);
  }

  private drawStageCard(): void {
    const card = this.stageCard;
    if (!card) return;
    const { ctx, w, h } = this.s;
    const t = card.t;
    const inK = clamp01(t / 0.35);
    const outK = 1 - clamp01((t - 1.9) / 0.7);
    const a = Math.min(outExpo(inK), outCubic(outK));
    if (a <= 0.01) return;
    const cx = w / 2;
    const cy = h * (this.layout.orient === "h" ? 0.5 : 0.42);
    const s = (this.layout.compact ? 40 : 64) * (0.86 + outBack(inK) * 0.14);
    ctx.save();
    ctx.globalAlpha = 1;
    neon(ctx, card.stage.title, cx, cy - s * 0.85, s, "white", { alpha: a * 0.95 });
    drawGlyphChain(ctx, card.stage.glyph, cx, cy + s * 0.55, s * 0.44, a * 0.9, true);
    ctx.restore();
  }

  private drawBanner(): void {
    const b = this.gateBanner;
    if (!b) return;
    const { ctx, w, h } = this.s;
    const k = clamp01(b.t / 1.5);
    const a = (1 - k) * (1 - k);
    const s = (this.layout.compact ? 30 : 48) * (1 + outQuint(clamp01(b.t * 4)) * 0.3);
    neon(ctx, b.text, w / 2, h * (this.layout.orient === "h" ? 0.34 : 0.3), s, b.ink, { alpha: a });
  }

  get lastFrameCost(): number {
    return this.frameCost;
  }

  reset(): void {
    this.particles.clear();
    this.ripples.clear();
    this.popups.length = 0;
    this.shake.reset();
    this.flash.reset();
    this.hitstop.reset();
    this.displayScore = 0;
    this.stageCard = null;
    this.gateBanner = null;
  }
}

// ------------------------------------------------------------------ helpers

/** Subdivision shape. Positive div = per-beat; negative = |n| across the bar. */
function shape(ctx: CanvasRenderingContext2D, div: number, x: number, y: number, r: number, gate: boolean): void {
  if (gate) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, r * 0.84, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (div < 0) {
    // Polyrhythm: a ring with |div| spokes — you can count the beam.
    const n = -div;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      ctx.moveTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
      ctx.lineTo(x + Math.cos(a) * r * 1.22, y + Math.sin(a) * r * 1.22);
    }
    ctx.stroke();
    return;
  }
  if (div <= 1) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  const sides = div === 2 ? 4 : div === 3 ? 3 : 6;
  const rot = div === 2 ? Math.PI / 4 : -Math.PI / 2;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

/**
 * Token widths for a chain of stacked fractions and plain words.
 *
 * Shared by the drawing and by the width query beside it, so the box a caller
 * reserves and the marks that land in it are measured exactly once.
 */
function tokenWidths(
  ctx: CanvasRenderingContext2D,
  tokens: readonly string[],
  size: number,
  fracPad: number,
  wordScale: number,
): number[] {
  const widths: number[] = [];
  for (const tk of tokens) {
    const m = FRACTION_TOKEN.exec(tk);
    if (m) {
      setFont(ctx, size);
      widths.push(
        Math.max(ctx.measureText(m[1]!).width, ctx.measureText(m[2]!).width) + size * fracPad,
      );
    } else {
      widths.push(measure(ctx, tk, size * wordScale));
    }
  }
  return widths;
}

const sum = (a: number[], gap: number): number =>
  a.reduce((x, y) => x + y, 0) + gap * Math.max(0, a.length - 1);

/** How wide `drawPromptTokens` will be. The layout reserves exactly this. */
export function promptWidth(ctx: CanvasRenderingContext2D, prompt: string, size: number): number {
  const tokens = prompt.split(/\s+/).filter(Boolean);
  return sum(tokenWidths(ctx, tokens, size, 0.2, 1.05), size * 0.42);
}

/** How wide `drawGlyphChain` will be. */
export function glyphChainWidth(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  size: number,
): number {
  const parts = glyph.split(/\s+/).filter(Boolean);
  return sum(tokenWidths(ctx, parts, size, 0.24, 1), size * 0.4);
}

/** Render "1/2 + 1/4" with real stacked fractions and the operator between them. */
export function drawPromptTokens(
  ctx: CanvasRenderingContext2D,
  prompt: string,
  cx: number,
  cy: number,
  size: number,
  alpha: number,
): void {
  const tokens = prompt.split(/\s+/).filter(Boolean);
  const gap = size * 0.42;
  const widths = tokenWidths(ctx, tokens, size, 0.2, 1.05);
  const total = sum(widths, gap);
  let x = cx - total / 2;
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i]!;
    const wI = widths[i]!;
    const m = FRACTION_TOKEN.exec(tk);
    if (m) fraction(ctx, Number(m[1]), Number(m[2]), x + wI / 2, cy, size, "white", alpha);
    else neon(ctx, tk, x + wI / 2, cy, size * 1.05, "amber", { alpha });
    x += wI + gap;
  }
}

/** "1/8 · 1/12" or "1/3 : 1/4" drawn as stacked fractions with the joiner kept. */
function drawGlyphChain(
  ctx: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  size: number,
  alpha: number,
  centred = false,
): void {
  const parts = glyph.split(/\s+/).filter(Boolean);
  const widths = tokenWidths(ctx, parts, size, 0.24, 1);
  const gap = size * 0.4;
  const total = sum(widths, gap);
  let cx = centred ? x - total / 2 : x;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const wI = widths[i]!;
    const m = FRACTION_TOKEN.exec(p);
    if (m) fraction(ctx, Number(m[1]), Number(m[2]), cx + wI / 2, y, size, "lime", alpha);
    else neon(ctx, p, cx + wI / 2, y, size, "cyan", { alpha: alpha * 0.7 });
    cx += wI + gap;
  }
}

export { lerp, impulse, rgb, halo };
