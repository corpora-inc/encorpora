/**
 * Canvas renderer.
 *
 * Why 2D canvas and not Three.js: the whole visual thesis of this game is that
 * a bar of music is a fraction bar — a straight line cut into equal slices, read
 * left to right like a number line. That is a 2D idea, and forcing it into a 3D
 * scene would cost frame budget and legibility to gain nothing. The dazzle comes
 * from where it belongs in this genre: a skyline cut live from the FFT of the
 * master bus, a waveform for a horizon, real bloom, and a lot of pooled
 * particles.
 *
 * Legibility rules that are enforced here and are not negotiable:
 *  - Note glyphs differ by SHAPE as well as colour.
 *  - Every numeral is heavy grotesque, drawn with a dark contrast pass behind
 *    it, at a size derived from the short screen axis.
 *  - Full-screen luminance jumps are rate-limited and amplitude-capped. A
 *    children's product does not get to strobe.
 */

import type { Game, Lane } from "../game/core.ts";
import {
  LANE_COLOR, LANE_NAME, LANE_SHAPE, font, mix, rgba, themeFor,
  TIER_SPEC, type Rgb, type Tier,
} from "../theme.ts";
import { safeInsets, safeRect } from "../../../../packs/shared/game-chrome/index.ts";
import { layoutFor, LEAD, type Layout } from "./layout.ts";
import { drawRich, measureRich } from "./typeset.ts";
import {
  Particles, PAL_BLOOM, PAL_DIM, PAL_GOLD, PAL_HORIZON, PAL_WHITE,
} from "./particles.ts";
const HISTORY = 110;
const FLASH_MIN_GAP = 0.34;
const FLASH_MAX = 0.42;

type Hist = { t: number; lane: Lane; power: number; live: boolean };

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bloomA: HTMLCanvasElement;
  private bloomB: HTMLCanvasElement;
  private noteGlow: HTMLCanvasElement[] = [];

  private dpr = 1;
  W = 0;
  H = 0;
  private playTop = 0;
  private playH = 0;
  private laneH = 0;
  private strikeX = 0;
  private pps = 200;
  private u = 10; // type unit, from the short axis
  /**
   * Where the readable things go. Rebuilt on every resize from the measured
   * safe area, so the HUD is never under the notch and never under the host's
   * two 44px corner controls.
   */
  private lay: Layout = layoutFor(320, { x: 0, y: 0, w: 320, h: 240 }, {
    top: 0, right: 0, bottom: 0, left: 0,
  });

  private spec = TIER_SPEC.mid;
  tier: Tier = "mid";

  private smoothFar: Float32Array;
  private smoothNear: Float32Array;
  private dustX: Float32Array;
  private dustY: Float32Array;
  private dustZ: Float32Array;

  private hist: Hist[] = [];
  private histCur = 0;

  private lastBeat = -1;
  private beatPulse = 0;
  private barPulse = 0;
  private comboPop = 0;
  private lastFlashAt = -10;
  private crackSeed: Float32Array;

  constructor(
    private canvas: HTMLCanvasElement,
    private game: Game,
    tier: Tier,
  ) {
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("[splitbeat] 2D canvas context unavailable");
    this.ctx = c;
    this.bloomA = document.createElement("canvas");
    this.bloomB = document.createElement("canvas");
    this.smoothFar = new Float32Array(TIER_SPEC.ultra.bars);
    this.smoothNear = new Float32Array(TIER_SPEC.ultra.bars);
    this.dustX = new Float32Array(TIER_SPEC.ultra.dust);
    this.dustY = new Float32Array(TIER_SPEC.ultra.dust);
    this.dustZ = new Float32Array(TIER_SPEC.ultra.dust);
    this.crackSeed = new Float32Array(64);
    for (let i = 0; i < this.crackSeed.length; i++) this.crackSeed[i] = Math.random();
    for (let i = 0; i < HISTORY; i++) this.hist.push({ t: -99, lane: 0, power: 0, live: false });
    this.particles = new Particles(4, 4, 4); // replaced by setTier
    this.setTier(tier);
  }

  particles: Particles;

  setTier(t: Tier): void {
    this.tier = t;
    this.spec = TIER_SPEC[t];
    this.particles = new Particles(this.spec.sparks, this.spec.shards, this.spec.rings);
    const th = themeFor(this.game.sector.id);
    this.particles.setSectorColors(th.horizon, th.bloom);
    this.resize();
  }

  resize(): void {
    const w = Math.max(320, this.canvas.clientWidth || window.innerWidth);
    const h = Math.max(240, this.canvas.clientHeight || window.innerHeight);
    this.dpr = Math.min(this.spec.maxDpr, window.devicePixelRatio || 1);
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    // The canvas still covers the whole frame — the canyon, the skyline and the
    // dust are meant to bleed under the notch, which is what `viewport-fit=cover`
    // is for. It is the lanes, the strike line and every numeral that move
    // inside the safe rectangle.
    const insets = safeInsets();
    const lay = layoutFor(w, safeRect(w, h, insets), insets);
    this.lay = lay;
    this.u = lay.u;
    this.playTop = lay.playTop;
    this.playH = lay.playH;
    this.laneH = lay.laneH;
    this.strikeX = lay.strikeX;
    this.pps = lay.pps;

    const bw = Math.max(64, Math.round(this.canvas.width / 4));
    const bh = Math.max(48, Math.round(this.canvas.height / 4));
    this.bloomA.width = bw;
    this.bloomA.height = bh;
    this.bloomB.width = Math.max(32, bw >> 1);
    this.bloomB.height = Math.max(24, bh >> 1);

    for (let i = 0; i < this.dustX.length; i++) {
      this.dustX[i] = Math.random() * w;
      this.dustY[i] = Math.random() * h;
      this.dustZ[i] = 0.2 + Math.random() * 1.4;
    }
    this.bakeNoteGlow();
  }

  private bakeNoteGlow(): void {
    this.noteGlow = [];
    const r = Math.max(24, Math.round(this.laneH * 0.9));
    for (let l = 0; l < 3; l++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = r * 2;
      const g = cv.getContext("2d")!;
      const grd = g.createRadialGradient(r, r, 0, r, r, r);
      const c = LANE_COLOR[l]!;
      grd.addColorStop(0, rgba(c, 0.95));
      grd.addColorStop(0.28, rgba(c, 0.42));
      grd.addColorStop(1, rgba(c, 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, r * 2, r * 2);
      this.noteGlow.push(cv);
    }
  }

  /** screen y of a lane's centre — lane 0 (low) sits at the bottom */
  laneY(l: number): number {
    return this.playTop + (2 - l) * this.laneH + this.laneH / 2;
  }

  laneFromY(y: number): Lane {
    const rel = (y - this.playTop) / this.laneH;
    const idx = 2 - Math.floor(rel);
    return Math.max(0, Math.min(2, idx)) as Lane;
  }

  private xAt(t: number, now: number): number {
    return this.strikeX + (t - now) * this.pps;
  }

  /* ================================================================ */

  frame(dt: number, now: number): void {
    const g = this.game;
    const ctx = this.ctx;
    const th = themeFor(g.sector.id);

    this.drainEvents(now);
    this.particles.update(dt);
    if (this.comboPop > 0) this.comboPop = Math.max(0, this.comboPop - dt * 3.4);
    if (this.beatPulse > 0) this.beatPulse = Math.max(0, this.beatPulse - dt * 3.2);
    if (this.barPulse > 0) this.barPulse = Math.max(0, this.barPulse - dt * 2.1);
    this.trackBeat(now);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // sky
    const grd = ctx.createLinearGradient(0, 0, 0, this.H);
    const lift = Math.min(0.35, this.beatPulse * 0.22 + g.fx.flash * 0.4);
    grd.addColorStop(0, `rgb(${th.skyTop[0]},${th.skyTop[1]},${th.skyTop[2]})`);
    grd.addColorStop(0.55, `rgb(${mix(th.skyTop, th.skyBottom, 0.75 + lift)[0]},${mix(th.skyTop, th.skyBottom, 0.75 + lift)[1]},${mix(th.skyTop, th.skyBottom, 0.75 + lift)[2]})`);
    grd.addColorStop(1, `rgb(${th.skyBottom[0]},${th.skyBottom[1]},${th.skyBottom[2]})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, this.W, this.H);

    // camera
    ctx.save();
    if (!g.reduced) {
      const amp = g.fx.shake * this.u * 0.62;
      const sx = Math.cos(g.fx.shakeAngle) * amp + (Math.random() - 0.5) * amp * 0.9;
      const sy = Math.sin(g.fx.shakeAngle) * amp + (Math.random() - 0.5) * amp * 0.9;
      ctx.translate(this.W / 2 + sx, this.H / 2 + sy);
      ctx.scale(g.fx.zoom, g.fx.zoom);
      ctx.translate(-this.W / 2, -this.H / 2);
    }

    this.drawDust(dt, th);
    this.drawSkyline(th);
    this.drawGrid(now, th);
    if (this.spec.scope) this.drawScope(th);
    this.drawLaneBands(th);
    if (this.spec.ribbon) this.drawRibbon(now);
    this.drawNotes(now, g);
    this.drawGates(now, g);
    this.drawStrike(th);
    this.particles.draw(ctx, font);

    ctx.restore();

    if (this.spec.bloom) this.applyBloom();
    this.drawPost(g);
    this.drawHud(now, g, th);
  }

  /* ---------------------------------------------------------------- */

  private trackBeat(now: number): void {
    const g = this.game;
    for (const b of g.barGrid) {
      if (now < b.t || now >= b.t + b.dur) continue;
      const spb = b.dur / 4;
      const beat = Math.floor((now - b.t) / spb);
      const id = Math.round(b.t * 100) * 4 + beat;
      if (id !== this.lastBeat) {
        this.lastBeat = id;
        this.beatPulse = 1;
        if (beat === 0) this.barPulse = 1;
        if (!this.game.reduced) {
          this.particles.ring(this.strikeX, this.playTop + this.playH / 2, this.laneH * 0.4, this.laneH * (beat === 0 ? 2.4 : 1.5), beat === 0 ? 0.5 : 0.34, beat === 0 ? 3 : 2, PAL_HORIZON);
        }
      }
      return;
    }
  }

  private drainEvents(now: number): void {
    const g = this.game;
    const n = g.pendingEvents;
    if (n === 0) return;
    const rnd = Math.random;
    for (let i = 0; i < n; i++) {
      const e = g.events[i]!;
      const y = this.laneY(e.lane);
      const pal = e.lane;
      switch (e.kind) {
        case "hit": {
          const power = e.strength * (e.accent ? 1.5 : 1);
          const count = Math.round((this.spec.sparks / 44) * power);
          this.particles.burst(this.strikeX, y, count, pal, 300 * power, rnd, this.spec.streaks);
          this.particles.ring(this.strikeX, y, this.laneH * 0.16, this.laneH * (0.6 + power * 0.7), 0.34, 3 + power * 3, pal, LANE_SHAPE[e.lane] === "square");
          if (e.verdict === "perfect") {
            this.particles.ring(this.strikeX, y, this.laneH * 0.1, this.laneH * 1.5, 0.46, 2, PAL_GOLD);
            this.particles.burst(this.strikeX, y, Math.round(count * 0.4), PAL_GOLD, 420, rnd, this.spec.streaks);
          }
          this.pushHist(now, e.lane, power);
          this.comboPop = 1;
          break;
        }
        case "miss":
          this.particles.burst(this.strikeX, y, Math.round(this.spec.sparks / 60), PAL_DIM, 160, rnd, false);
          this.particles.floater(this.strikeX + this.u * 3, y - this.laneH * 0.3, "MISS", this.u * 1.5, PAL_DIM);
          break;
        case "ghost":
          this.particles.ring(this.strikeX, y, this.laneH * 0.1, this.laneH * 0.3, 0.2, 2, PAL_DIM);
          break;
        case "gate-correct": {
          const cx = this.strikeX;
          const cy = this.playTop + this.playH / 2;
          for (let k = 0; k < this.spec.shards; k++) {
            const a = rnd() * Math.PI * 2;
            const sp = 200 + rnd() * 900;
            this.particles.shard(
              cx + (rnd() - 0.5) * this.u * 4,
              this.playTop + rnd() * this.playH,
              Math.cos(a) * sp + 240,
              Math.sin(a) * sp - 260,
              0.8 + rnd() * 0.8,
              this.u * (0.4 + rnd() * 1.1),
              rnd() < 0.5 ? PAL_WHITE : PAL_HORIZON,
              (rnd() - 0.5) * 14,
            );
          }
          this.particles.burst(cx, cy, this.spec.sparks >> 2, PAL_WHITE, 900, rnd, this.spec.streaks);
          this.particles.ring(cx, cy, this.u, this.W * 0.9, 0.8, 8, PAL_WHITE);
          this.particles.ring(cx, cy, this.u, this.W * 0.6, 0.6, 5, PAL_GOLD);
          this.particles.floater(cx + this.u * 6, cy - this.laneH, "SPLIT!", this.u * 3, PAL_GOLD);
          this.bigFlash(now, 0.4);
          break;
        }
        case "gate-wrong": {
          const cy = this.playTop + this.playH / 2;
          this.particles.burst(this.strikeX, cy, this.spec.sparks >> 3, PAL_DIM, 500, rnd, false);
          this.particles.ring(this.strikeX, cy, this.u, this.W * 0.5, 0.7, 6, PAL_DIM, true);
          break;
        }
        case "charge-up":
          this.particles.floater(this.strikeX + this.u * 3, this.laneY(e.lane) - this.laneH * 0.4, "+1", this.u * 1.8, PAL_GOLD);
          break;
        case "sector": {
          this.particles.burst(this.W / 2, this.playTop + this.playH / 2, this.spec.sparks >> 2, PAL_BLOOM, 1100, rnd, this.spec.streaks);
          this.particles.ring(this.W / 2, this.playTop + this.playH / 2, this.u, this.W, 1.0, 10, PAL_BLOOM);
          const th = themeFor(this.game.sector.id);
          this.particles.setSectorColors(th.horizon, th.bloom);
          this.bigFlash(now, 0.36);
          break;
        }
        case "breakdown":
          this.particles.burst(this.strikeX, this.playTop + this.playH / 2, this.spec.sparks >> 2, PAL_DIM, 700, rnd, false);
          break;
        case "revive":
          this.particles.burst(this.W / 2, this.playTop + this.playH / 2, this.spec.sparks >> 1, PAL_GOLD, 1200, rnd, this.spec.streaks);
          this.particles.ring(this.W / 2, this.playTop + this.playH / 2, this.u, this.W * 1.2, 0.9, 12, PAL_GOLD);
          this.bigFlash(now, 0.42);
          break;
      }
    }
    g.clearEvents();
  }

  /** Rate-limited and amplitude-capped. Children's product. */
  private bigFlash(now: number, amount: number): void {
    if (this.game.reduced) return;
    if (now - this.lastFlashAt < FLASH_MIN_GAP) return;
    this.lastFlashAt = now;
    this.game.fx.flash = Math.min(FLASH_MAX, Math.max(this.game.fx.flash, amount));
  }

  private pushHist(t: number, lane: Lane, power: number): void {
    const h = this.hist[this.histCur % HISTORY]!;
    this.histCur++;
    h.t = t;
    h.lane = lane;
    h.power = power;
    h.live = true;
  }

  /* ---------------------------------------------------------------- */
  /* background                                                        */
  /* ---------------------------------------------------------------- */

  private drawDust(dt: number, th: ReturnType<typeof themeFor>): void {
    const n = this.spec.dust;
    if (n === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      let x = this.dustX[i]! - this.dustZ[i]! * 26 * dt;
      if (x < -4) {
        x = this.W + 4;
        this.dustY[i] = Math.random() * this.H;
      }
      this.dustX[i] = x;
      const a = 0.05 + this.dustZ[i]! * 0.09 + this.beatPulse * 0.06;
      ctx.fillStyle = rgba(th.horizon, a);
      const s = this.dustZ[i]! * 1.5;
      ctx.fillRect(x, this.dustY[i]!, s, s);
    }
    ctx.restore();
  }

  /**
   * The canyon: two skylines cut from the live FFT, one hanging from the top
   * and one rising from the bottom, with the playfield in the gap between them.
   */
  private drawSkyline(th: ReturnType<typeof themeFor>): void {
    const ctx = this.ctx;
    const eng = this.game.eng;
    const bars = this.spec.bars;
    const bw = this.W / bars;
    const topEdge = this.playTop;
    const botEdge = this.playTop + this.playH;
    const maxUp = topEdge * 0.98;
    const maxDown = (this.H - botEdge) * 0.98;

    for (let pass = 0; pass < 2; pass++) {
      const far = pass === 0;
      const smooth = far ? this.smoothFar : this.smoothNear;
      const col = far ? th.farBar : th.nearBar;
      const k = far ? 0.10 : 0.26;
      const skew = far ? 0.55 : 1;
      ctx.fillStyle = rgba(col, far ? 0.55 : 0.9);
      for (let i = 0; i < bars; i++) {
        const bin = Math.min(
          eng.freq.length - 1,
          Math.floor(Math.pow((i + 0.5) / bars, 1.75) * 190) + (far ? 2 : 0),
        );
        const target = (eng.freq[bin] ?? 0) / 255;
        smooth[i] = smooth[i]! + (target - smooth[i]!) * k;
        const v = Math.pow(smooth[i]!, 1.35) * skew;
        const x = i * bw + (far ? bw * 0.1 : bw * 0.22);
        const w = bw * (far ? 0.8 : 0.56);
        const hUp = 8 + v * maxUp;
        const hDn = 8 + v * maxDown;
        ctx.fillRect(x, topEdge - hUp, w, hUp);
        ctx.fillRect(x, botEdge, w, hDn);
      }
    }

    // horizon glow along both playfield edges
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const y of [topEdge, botEdge]) {
      const g = ctx.createLinearGradient(0, y - this.u * 1.5, 0, y + this.u * 1.5);
      g.addColorStop(0, rgba(th.horizon, 0));
      g.addColorStop(0.5, rgba(th.horizon, 0.32 + this.beatPulse * 0.2));
      g.addColorStop(1, rgba(th.horizon, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - this.u * 1.5, this.W, this.u * 3);
    }
    ctx.restore();
  }

  private drawScope(th: ReturnType<typeof themeFor>): void {
    const ctx = this.ctx;
    const w = this.game.eng.wave;
    const cy = this.playTop + this.playH / 2;
    const amp = this.laneH * 0.62;
    const step = Math.max(1, Math.floor(w.length / Math.min(this.W, 480)));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(th.horizon, 0.22);
    ctx.lineWidth = Math.max(1, this.u * 0.16);
    ctx.beginPath();
    for (let i = 0, k = 0; i < w.length; i += step, k++) {
      const x = (i / w.length) * this.W;
      const y = cy + ((w[i]! - 128) / 128) * amp;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The floor, ruled into the current subdivision. This is the thesis: the bar
   * is a fraction bar, cut into `cells` equal slices, and every note lands on a
   * cut. Answer `1/8` at a gate and the world re-rules itself into eight.
   */
  private drawGrid(now: number, th: ReturnType<typeof themeFor>): void {
    const ctx = this.ctx;
    const top = this.playTop;
    const bot = this.playTop + this.playH;
    for (const b of this.game.barGrid) {
      const x0 = this.xAt(b.t, now);
      const x1 = this.xAt(b.t + b.dur, now);
      if (x1 < -40 || x0 > this.W + 40) continue;
      const cw = (x1 - x0) / b.cells;

      // alternating cell tint so "cut into N" is read as segments, not ticks
      for (let i = 0; i < b.cells; i += 2) {
        const cx = x0 + i * cw;
        if (cx > this.W || cx + cw < 0) continue;
        ctx.fillStyle = rgba(th.grid, 0.045);
        ctx.fillRect(cx, top, cw, this.playH);
      }
      // cell dividers
      ctx.fillStyle = rgba(th.grid, 0.2);
      for (let i = 1; i < b.cells; i++) {
        const cx = x0 + i * cw;
        if (cx < -2 || cx > this.W + 2) continue;
        ctx.fillRect(cx, top, Math.max(1, this.u * 0.06), this.playH);
      }
      // bar line, and the fraction it represents
      if (x0 > -2 && x0 < this.W + 2) {
        ctx.fillStyle = rgba(th.horizon, 0.5 + this.barPulse * 0.35);
        ctx.fillRect(x0 - this.u * 0.06, top, Math.max(1.5, this.u * 0.14), this.playH);
        const label = `1/${b.cells}`;
        drawRich(ctx, label, x0 + this.u * 0.5, bot - this.u * 1.35, this.u * 0.82, {
          fill: rgba(th.horizon, 0.4),
        });
      }
    }
  }

  private drawLaneBands(th: ReturnType<typeof themeFor>): void {
    const ctx = this.ctx;
    for (let l = 0; l < 3; l++) {
      const y = this.playTop + (2 - l) * this.laneH;
      const c = LANE_COLOR[l]!;
      const flash = Math.min(0.3, this.game.fx.laneFlash[l]! * 0.3);
      ctx.fillStyle = rgba(c, 0.035 + flash);
      ctx.fillRect(0, y, this.W, this.laneH);
      ctx.fillStyle = rgba(th.grid, 0.14);
      ctx.fillRect(0, y, this.W, Math.max(1, this.u * 0.05));
    }
    ctx.fillStyle = rgba(th.grid, 0.14);
    ctx.fillRect(0, this.playTop + this.playH, this.W, Math.max(1, this.u * 0.05));
  }

  /** Everything you have already played, streaming away behind the strike. */
  private drawRibbon(now: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const h of this.hist) {
      if (!h.live) continue;
      const age = now - h.t;
      if (age > 4 || age < 0) {
        if (age > 4) h.live = false;
        continue;
      }
      const x = this.strikeX - age * this.pps * 0.42;
      if (x < -20) {
        h.live = false;
        continue;
      }
      const a = (1 - age / 4) * 0.5;
      const y = this.laneY(h.lane);
      const r = this.laneH * 0.1 * (0.6 + h.power * 0.6);
      ctx.fillStyle = rgba(LANE_COLOR[h.lane]!, a);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------------------- */
  /* notes                                                             */
  /* ---------------------------------------------------------------- */

  private drawNotes(now: number, g: Game): void {
    const ctx = this.ctx;
    const chroma = g.reduced ? 0 : Math.min(1, g.fx.chroma) * this.u * 0.32;

    for (const n of g.notes) {
      if (!n.active || n.isChoice) continue;
      const x = this.xAt(n.time, now);
      if (x < -this.laneH || x > this.W + this.laneH) continue;
      const y = this.laneY(n.lane);
      const born = Math.min(1, (now - n.bornAt) / 0.25);
      let scale = 1;
      let alpha = born;

      if (n.state === 1) {
        const age = now - n.hitAt;
        if (age > 0.26) continue;
        const k = age / 0.26;
        scale = 1 + k * 1.7;
        alpha = (1 - k) * 0.9;
      } else if (n.state === 2) {
        const age = now - n.time;
        if (age > 0.5) continue;
        scale = 1 - Math.min(0.5, age);
        alpha = Math.max(0, 0.45 - age);
      } else {
        // gentle approach growth, so the strike is the peak of the motion
        const lead = Math.max(0, (n.time - now) / LEAD);
        scale = 0.82 + (1 - lead) * 0.18;
      }
      if (alpha <= 0.01) continue;

      const r = Math.min(this.laneH * 0.3, this.u * 1.5) * (n.accent ? 1.28 : 1) * scale;
      this.drawGlyph(ctx, x, y, r, n.lane, alpha, n.accent, n.state === 2, chroma);
    }
  }

  private drawGlyph(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, r: number, lane: number,
    alpha: number, accent: boolean, dead: boolean, chroma: number,
  ): void {
    const c = dead ? ([120, 128, 150] as Rgb) : LANE_COLOR[lane]!;
    const shape = LANE_SHAPE[lane]!;

    if (!dead) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * (accent ? 0.85 : 0.6);
      const gl = this.noteGlow[lane]!;
      const gr = r * 2.6;
      ctx.drawImage(gl, x - gr, y - gr, gr * 2, gr * 2);
      ctx.restore();
    }

    const path = (ox: number, oy: number, rr: number) => {
      ctx.beginPath();
      if (shape === "disc") {
        ctx.arc(x + ox, y + oy, rr, 0, Math.PI * 2);
      } else if (shape === "square") {
        const s = rr * 0.92;
        ctx.rect(x + ox - s, y + oy - s, s * 2, s * 2);
      } else {
        const s = rr * 1.12;
        ctx.moveTo(x + ox, y + oy - s);
        ctx.lineTo(x + ox + s * 0.92, y + oy + s * 0.72);
        ctx.lineTo(x + ox - s * 0.92, y + oy + s * 0.72);
        ctx.closePath();
      }
    };

    if (chroma > 0.2 && !dead) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillStyle = "rgb(255,40,40)";
      path(-chroma, 0, r);
      ctx.fill();
      ctx.fillStyle = "rgb(40,220,255)";
      path(chroma, 0, r);
      ctx.fill();
      ctx.restore();
    }

    ctx.globalAlpha = alpha;
    // dark contrast pass so a bright note never dissolves into a bright sky
    ctx.fillStyle = "rgba(4,6,16,0.85)";
    path(0, 0, r * 1.16);
    ctx.fill();

    ctx.fillStyle = rgba(c, 1);
    path(0, 0, r);
    ctx.fill();

    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = rgba(mix(c, [255, 255, 255], 0.65), 1);
    path(0, -r * 0.22, r * 0.42);
    ctx.fill();

    if (accent && !dead) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = Math.max(1.5, r * 0.16);
      path(0, 0, r * 1.42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- */
  /* gates                                                             */
  /* ---------------------------------------------------------------- */

  private drawGates(now: number, g: Game): void {
    const ctx = this.ctx;
    const top = this.playTop;
    const H = this.playH;

    for (const gate of g.gates) {
      if (!gate.active || gate === g.reviveGate) continue;
      // the slab rides just behind the tiles
      const sx = this.xAt(gate.time + 0.14, now);
      if (sx < -this.W || sx > this.W * 2) continue;
      const w = Math.max(this.u * 1.6, this.u * 2.2);

      let alpha = 1;
      let ox = 0;
      if (gate.resolved && gate.correct) {
        alpha = 1 - gate.shatter;
      } else if (gate.resolved && !gate.correct) {
        ox = -Math.sin(gate.crack * Math.PI) * this.u * 0.8;
      }
      if (alpha <= 0.02) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      const grd = ctx.createLinearGradient(sx + ox, top, sx + ox + w, top + H);
      grd.addColorStop(0, "rgba(10,14,32,0.94)");
      grd.addColorStop(0.5, "rgba(26,34,68,0.88)");
      grd.addColorStop(1, "rgba(8,10,24,0.94)");
      ctx.fillStyle = grd;
      ctx.fillRect(sx + ox, top, w, H);
      ctx.strokeStyle = gate.resolved && !gate.correct ? "rgba(255,120,140,0.95)" : "rgba(190,225,255,0.85)";
      ctx.lineWidth = Math.max(2, this.u * 0.16);
      ctx.strokeRect(sx + ox, top, w, H);

      // cracks grow as it approaches; they are the readable "this is coming"
      const cracks = Math.floor(gate.crack * 9);
      ctx.strokeStyle = `rgba(210,235,255,${0.15 + gate.crack * 0.5})`;
      ctx.lineWidth = Math.max(1, this.u * 0.06);
      ctx.beginPath();
      for (let i = 0; i < cracks; i++) {
        const s = this.crackSeed[i]!;
        const y0 = top + s * H;
        ctx.moveTo(sx + ox, y0);
        ctx.lineTo(sx + ox + w * (0.4 + s * 0.6), y0 + (s - 0.5) * this.u * 3);
      }
      ctx.stroke();
      ctx.restore();
    }

    // choice tiles
    const chroma = g.reduced ? 0 : Math.min(1, g.fx.chroma) * this.u * 0.25;
    for (const n of g.notes) {
      if (!n.active || !n.isChoice) continue;
      const x = this.xAt(n.time, now);
      if (x < -this.W * 0.5 || x > this.W + this.laneH * 3) continue;
      const y = this.laneY(n.lane);
      const born = Math.min(1, (now - n.bornAt) / 0.25);

      let alpha = born;
      let scale = 1;
      if (n.state === 1) {
        const age = now - n.hitAt;
        if (age > 0.4) continue;
        scale = 1 + (age / 0.4) * 0.5;
        alpha = 1 - age / 0.4;
      } else if (n.state === 2) {
        const age = now - n.time;
        if (age > 0.5) continue;
        alpha = Math.max(0, (1 - age / 0.5) * 0.35);
      }
      if (alpha <= 0.02) continue;

      const tw = Math.min(this.laneH * 1.5, this.u * 6.4) * scale;
      const thh = this.laneH * 0.76 * scale;
      const c = LANE_COLOR[n.lane]!;

      ctx.save();
      ctx.globalAlpha = alpha;
      if (chroma > 0.2) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.3;
        ctx.fillStyle = "rgb(255,40,40)";
        this.roundRect(ctx, x - tw / 2 - chroma, y - thh / 2, tw, thh, this.u * 0.5);
        ctx.fill();
        ctx.fillStyle = "rgb(40,220,255)";
        this.roundRect(ctx, x - tw / 2 + chroma, y - thh / 2, tw, thh, this.u * 0.5);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = alpha;
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.45;
      const gl = this.noteGlow[n.lane]!;
      ctx.drawImage(gl, x - tw * 0.8, y - thh * 0.9, tw * 1.6, thh * 1.8);
      ctx.restore();

      ctx.fillStyle = "rgba(6,9,22,0.93)";
      this.roundRect(ctx, x - tw / 2, y - thh / 2, tw, thh, this.u * 0.5);
      ctx.fill();
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = Math.max(2.5, this.u * 0.2);
      this.roundRect(ctx, x - tw / 2, y - thh / 2, tw, thh, this.u * 0.5);
      ctx.stroke();

      const size = Math.min(thh * 0.42, tw * 0.4);
      drawRich(ctx, n.label, x, y, size, { fill: "#ffffff", glow: rgba(c, 0.9), glowWidth: size * 0.5 }, true);
      ctx.restore();
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  /* ---------------------------------------------------------------- */
  /* strike column                                                     */
  /* ---------------------------------------------------------------- */

  private drawStrike(th: ReturnType<typeof themeFor>): void {
    const ctx = this.ctx;
    const g = this.game;
    const top = this.playTop;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createLinearGradient(this.strikeX - this.u * 3, 0, this.strikeX + this.u * 3, 0);
    glow.addColorStop(0, rgba(th.bloom, 0));
    glow.addColorStop(0.5, rgba(th.bloom, 0.22 + this.beatPulse * 0.25));
    glow.addColorStop(1, rgba(th.bloom, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(this.strikeX - this.u * 3, top, this.u * 6, this.playH);
    ctx.restore();

    for (let l = 0; l < 3; l++) {
      const y = this.laneY(l);
      const c = LANE_COLOR[l]!;
      const f = Math.min(1, g.fx.laneFlash[l]!);
      const w = this.u * 1.15;
      const h = this.laneH * 0.72;

      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(6,9,20,0.8)`;
      this.roundRect(ctx, this.strikeX - w / 2, y - h / 2, w, h, this.u * 0.34);
      ctx.fill();
      ctx.strokeStyle = rgba(c, 0.5 + f * 0.5);
      ctx.lineWidth = Math.max(2, this.u * (0.13 + f * 0.16));
      this.roundRect(ctx, this.strikeX - w / 2, y - h / 2, w, h, this.u * 0.34);
      ctx.stroke();

      if (f > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.min(0.5, f * 0.5);
        ctx.fillStyle = rgba(c, 1);
        this.roundRect(ctx, this.strikeX - w / 2, y - h / 2, w, h, this.u * 0.34);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- */
  /* post + hud                                                        */
  /* ---------------------------------------------------------------- */

  private applyBloom(): void {
    const ctx = this.ctx;
    const a = this.bloomA.getContext("2d")!;
    const b = this.bloomB.getContext("2d")!;
    a.globalCompositeOperation = "source-over";
    a.clearRect(0, 0, this.bloomA.width, this.bloomA.height);
    a.drawImage(this.canvas, 0, 0, this.bloomA.width, this.bloomA.height);
    b.clearRect(0, 0, this.bloomB.width, this.bloomB.height);
    b.drawImage(this.bloomA, 0, 0, this.bloomB.width, this.bloomB.height);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.34;
    ctx.drawImage(this.bloomA, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 0.42;
    ctx.drawImage(this.bloomB, 0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  private drawPost(g: Game): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (g.fx.flash > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,255,255,${Math.min(FLASH_MAX, g.fx.flash) * 0.5})`;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.restore();
    }
    if (g.fx.vignette > 0.01) {
      const r = Math.max(this.W, this.H);
      const grd = ctx.createRadialGradient(this.W / 2, this.H / 2, r * 0.25, this.W / 2, this.H / 2, r * 0.75);
      grd.addColorStop(0, "rgba(120,0,30,0)");
      grd.addColorStop(1, `rgba(150,10,40,${Math.min(0.55, g.fx.vignette * 0.55)})`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawHud(now: number, g: Game, th: ReturnType<typeof themeFor>): void {
    const ctx = this.ctx;
    const u = this.u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.textBaseline = "middle";

    const lay = this.lay;

    // --- score -------------------------------------------------------
    ctx.textAlign = "left";
    ctx.font = font(u * 2.05, 900);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fillText(String(Math.round(g.score)).padStart(6, "0"), lay.hudX, lay.scoreY);
    ctx.font = font(u * 0.78, 700);
    ctx.fillStyle = rgba(th.horizon, 0.75);
    ctx.fillText(`${g.sector.name}  ·  ${Math.round(g.bpm)} BPM  ·  LV ${g.difficulty.toFixed(1)}`, lay.hudX + u * 0.05, lay.sectorY);

    // --- charge ------------------------------------------------------
    const cellW = lay.chargeCellW;
    const cx0 = lay.chargeX;
    for (let i = 0; i < 5; i++) {
      const on = i < g.charge;
      const x = cx0 + i * (cellW + u * 0.1);
      ctx.fillStyle = on ? rgba(th.horizon, 0.95) : "rgba(255,255,255,0.13)";
      this.roundRect(ctx, x, lay.chargeY, cellW, lay.chargeCellH, u * 0.16);
      ctx.fill();
      if (!on) {
        ctx.strokeStyle = "rgba(255,255,255,0.22)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // --- combo -------------------------------------------------------
    if (g.combo > 2) {
      const pop = 1 + this.comboPop * 0.18;
      const size = u * (1.9 + Math.min(1.6, g.combo / 44)) * pop;
      ctx.textAlign = "left";
      ctx.font = font(size, 900);
      const glow = g.combo >= 40 ? [255, 226, 138] : [255, 255, 255];
      ctx.save();
      ctx.shadowColor = `rgba(${glow[0]},${glow[1]},${glow[2]},0.85)`;
      ctx.shadowBlur = size * 0.42;
      ctx.fillStyle = "#ffffff";
      const cy = this.playTop - u * 0.9;
      ctx.fillText(String(g.combo), this.strikeX - u * 0.2, cy);
      const w = ctx.measureText(String(g.combo)).width;
      ctx.font = font(size * 0.46, 800);
      ctx.fillStyle = rgba(th.horizon, 0.95);
      const mult = g.combo < 8 ? 1 : g.combo < 20 ? 2 : g.combo < 40 ? 3 : g.combo < 70 ? 4 : g.combo < 110 ? 6 : 8;
      ctx.fillText(`x${mult}`, this.strikeX + w + u * 0.2, cy + size * 0.12);
      ctx.restore();
    }

    // --- the question ------------------------------------------------
    const gate = g.phase === "breakdown" ? g.reviveGate : g.activeGate;
    if (gate && gate.q && !gate.resolved && now >= gate.revealAt - 0.05) {
      const size = Math.min(u * 2.5, lay.area.w / (measureRich(ctx, gate.q.prompt, 100) / 100) * 0.86);
      const bw = measureRich(ctx, gate.q.prompt, size) + u * 2.4;
      const bh = size * 2.3;
      const bx = lay.cx - bw / 2;
      const by = lay.promptY;
      ctx.fillStyle = "rgba(4,6,18,0.82)";
      this.roundRect(ctx, bx, by, bw, bh, u * 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba(th.horizon, 0.55);
      ctx.lineWidth = Math.max(1.5, u * 0.1);
      this.roundRect(ctx, bx, by, bw, bh, u * 0.55);
      ctx.stroke();
      drawRich(ctx, gate.q.prompt, lay.cx, by + bh / 2, size, {
        fill: "#ffffff",
        glow: rgba(th.horizon, 0.8),
        glowWidth: size * 0.4,
      }, true);

      if (g.phase !== "breakdown") {
        const remain = Math.max(0, Math.min(1, (gate.time - now) / 2.4));
        ctx.fillStyle = rgba(th.horizon, 0.85);
        ctx.fillRect(bx + u * 0.4, by + bh - u * 0.3, (bw - u * 0.8) * remain, u * 0.18);
      }
    }

    // --- timing meter ------------------------------------------------
    if (now - g.lastJudgeAt < 1.1 && g.lastVerdict) {
      const mw = Math.min(lay.area.w * 0.5, u * 13);
      const mx = lay.cx - mw / 2;
      const my = this.playTop + this.playH + u * 1.5;
      const a = 1 - (now - g.lastJudgeAt) / 1.1;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(mx, my - u * 0.1, mw, u * 0.2);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(lay.cx - u * 0.05, my - u * 0.4, u * 0.1, u * 0.8);
      if (g.lastVerdict !== "miss") {
        const p = Math.max(-1, Math.min(1, g.lastDelta / 0.2));
        ctx.fillStyle = rgba(th.horizon, 1);
        ctx.fillRect(lay.cx + (p * mw) / 2 - u * 0.12, my - u * 0.5, u * 0.24, u);
      }
      ctx.textAlign = "center";
      ctx.font = font(u * 0.72, 800);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const word = g.lastVerdict.toUpperCase();
      const side = g.lastVerdict === "miss" ? "" : g.lastDelta < -0.012 ? "  EARLY" : g.lastDelta > 0.012 ? "  LATE" : "";
      ctx.fillText(word + side, lay.cx, my + u * 1.1);
      ctx.globalAlpha = 1;
    }

    // --- lane legend at the strike ------------------------------------
    ctx.textAlign = "center";
    ctx.font = font(u * 0.55, 800);
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = rgba(LANE_COLOR[l]!, 0.5);
      ctx.fillText(LANE_NAME[l]!, this.strikeX, this.laneY(l) + this.laneH * 0.42);
    }

    // --- sector announce ---------------------------------------------
    if (g.sectorFlash > 0) {
      const a = Math.sin(Math.min(1, g.sectorFlash) * Math.PI);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = font(u * 4.2, 900);
      ctx.fillStyle = rgba(th.horizon, 0.9);
      ctx.fillText(g.sector.name, lay.cx, this.playTop + this.playH / 2);
      ctx.globalAlpha = 1;
    }

    // --- breakdown overlay -------------------------------------------
    if (g.phase === "breakdown" && g.reviveGate) {
      ctx.fillStyle = "rgba(3,4,12,0.72)";
      ctx.fillRect(0, 0, this.W, this.H);
      const pulse = 0.5 + 0.5 * Math.sin(now * 5);
      ctx.textAlign = "center";
      ctx.font = font(u * 1.15, 900);
      ctx.fillStyle = rgba(th.horizon, 0.7 + pulse * 0.3);
      ctx.fillText("RESTART THE HEART", lay.cx, this.playTop - u * 1.2);

      for (let l = 0; l < 3; l++) {
        const y = this.laneY(l);
        const c = LANE_COLOR[l]!;
        const w = Math.min(lay.area.w * 0.82, u * 20);
        const h = this.laneH * 0.78;
        ctx.fillStyle = "rgba(7,10,24,0.95)";
        this.roundRect(ctx, lay.cx - w / 2, y - h / 2, w, h, u * 0.6);
        ctx.fill();
        ctx.strokeStyle = rgba(c, 0.75 + pulse * 0.25);
        ctx.lineWidth = Math.max(3, u * 0.24);
        this.roundRect(ctx, lay.cx - w / 2, y - h / 2, w, h, u * 0.6);
        ctx.stroke();
        drawRich(ctx, g.reviveGate.labels[l]!, lay.cx, y, Math.min(h * 0.44, u * 2.6), {
          fill: "#ffffff", glow: rgba(c, 0.9), glowWidth: u,
        }, true);
      }
    }
  }
}
