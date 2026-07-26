/**
 * The live renderer. Everything hot, everything animated, one canvas.
 *
 * Draw order is fixed: baked ground, flowing lava, plots, ranges, enemies,
 * towers, ordnance (additive), particles (two passes), numbers, flash.
 */
import { BOARD, C, TOWERS, towerRange, type TowerKind } from "../game/constants.ts";
import type { State } from "../game/state.ts";
import { PKind, type Particles } from "./particles.ts";
import { clamp01, easeOutBack, easeOutCubic } from "../core/easing.ts";

export type View = {
  w: number;
  h: number;
  dpr: number;
  scale: number;
  ox: number;
  oy: number;
};

export function computeView(cssW: number, cssH: number, dpr: number): View {
  const pad = 6;
  const scale = Math.min((cssW - pad * 2) / BOARD, (cssH - pad * 2) / BOARD);
  return {
    w: cssW,
    h: cssH,
    dpr,
    scale,
    ox: (cssW - BOARD * scale) / 2,
    oy: (cssH - BOARD * scale) / 2,
  };
}

export function screenToBoard(v: View, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale };
}

export function boardToScreen(v: View, x: number, y: number): { x: number; y: number } {
  return { x: v.ox + x * v.scale, y: v.oy + y * v.scale };
}

const FONT = `800 1px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif`;
const font = (px: number): string => FONT.replace("1px", `${px}px`);

/**
 * Baked glow sprites. `createRadialGradient` per particle per frame is the
 * single most expensive thing a 2d canvas game can do; one drawImage of a
 * pre-rendered blob is an order of magnitude cheaper and looks softer.
 */
function makeGlow(r: number, g: number, b: number): HTMLCanvasElement {
  const S = 96;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const x = c.getContext("2d") as CanvasRenderingContext2D;
  const grad = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(0.26, `rgba(${r},${g},${b},0.62)`);
  grad.addColorStop(0.62, `rgba(${r},${g},${b},0.16)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);
  return c;
}

let RIFT: HTMLCanvasElement | null = null;
function riftGlow(): HTMLCanvasElement {
  if (!RIFT) RIFT = makeGlow(150, 214, 255);
  return RIFT;
}

let GLOW: { white: HTMLCanvasElement; hot: HTMLCanvasElement; deep: HTMLCanvasElement } | null = null;
function glows(): { white: HTMLCanvasElement; hot: HTMLCanvasElement; deep: HTMLCanvasElement } {
  if (!GLOW) {
    GLOW = {
      white: makeGlow(255, 244, 214),
      hot: makeGlow(255, 152, 52),
      deep: makeGlow(255, 78, 18),
    };
  }
  return GLOW;
}

const hex = (c: string): [number, number, number] => [
  parseInt(c.slice(1, 3), 16),
  parseInt(c.slice(3, 5), 16),
  parseInt(c.slice(5, 7), 16),
];

/** blend two #rrggbb colours; used for hit flashes so silhouettes survive */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

function blob(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------

export type DrawOpts = {
  hoverPlot: number;
  selectedPlot: number;
  buildPreview: TowerKind | null;
  reducedMotion: boolean;
  wallT: number;
  /** 0..1 hint pulse for the first-tower nudge */
  hint: number;
  shakeX: number;
  shakeY: number;
  shakeRot: number;
  zoom: number;
  flash: number;
  frozen: boolean;
};

export class Renderer {
  private baked: HTMLCanvasElement | null = null;
  private amb: CanvasGradient | null = null;
  private ambKey = "";

  setBaked(c: HTMLCanvasElement): void {
    this.baked = c;
  }

  private ambient(ctx: CanvasRenderingContext2D, v: View): CanvasGradient {
    const key = `${v.w}x${v.h}`;
    if (this.amb && this.ambKey === key) return this.amb;
    const g = ctx.createRadialGradient(
      v.w / 2,
      v.h * 0.52,
      10,
      v.w / 2,
      v.h * 0.52,
      Math.max(v.w, v.h) * 0.75,
    );
    g.addColorStop(0, "#160e10");
    g.addColorStop(1, "#070405");
    this.amb = g;
    this.ambKey = key;
    return g;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    v: View,
    s: State,
    p: Particles,
    o: DrawOpts,
  ): void {
    const t = o.wallT;
    ctx.save();
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);

    // ambient beyond the board: the cavern the forge sits in
    ctx.fillStyle = this.ambient(ctx, v);
    ctx.fillRect(0, 0, v.w, v.h);

    // camera
    ctx.translate(v.w / 2 + o.shakeX, v.h / 2 + o.shakeY);
    ctx.rotate(o.shakeRot);
    ctx.scale(o.zoom, o.zoom);
    ctx.translate(-v.w / 2, -v.h / 2);
    ctx.translate(v.ox, v.oy);
    ctx.scale(v.scale, v.scale);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, BOARD, BOARD);
    ctx.clip();

    if (this.baked) ctx.drawImage(this.baked, 0, 0, BOARD, BOARD);

    this.drawLava(ctx, s, t, o.reducedMotion);
    this.drawRift(ctx, s, t, o.reducedMotion);
    this.drawPlots(ctx, s, o, t);
    this.drawRanges(ctx, s, o);
    this.drawCore(ctx, s, t, o.reducedMotion);

    this.drawParticles(ctx, p, false);
    this.drawEnemies(ctx, s, t, o.reducedMotion);
    this.drawTowers(ctx, s, t, o);
    this.drawOrdnance(ctx, s);
    this.drawParticles(ctx, p, true);
    this.drawPopups(ctx, s);

    ctx.restore();

    // board frame — a hot seam that makes the play area feel forged
    ctx.strokeStyle = "rgba(255,140,60,0.22)";
    ctx.lineWidth = 2 / v.scale;
    ctx.strokeRect(0, 0, BOARD, BOARD);

    ctx.restore();

    if (o.flash > 0.001) {
      ctx.save();
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.fillStyle = `rgba(255,226,180,${o.flash})`;
      ctx.fillRect(0, 0, v.w, v.h);
      ctx.restore();
    }
  }

  // -- layers --------------------------------------------------------------

  private drawLava(ctx: CanvasRenderingContext2D, s: State, t: number, reduced: boolean): void {
    const path = s.path;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    const p0 = path.pts[0];
    if (p0) {
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < path.pts.length; i++) {
        const q = path.pts[i];
        if (q) ctx.lineTo(q.x, q.y);
      }
    }
    const pulse = reduced ? 0 : Math.sin(t * 1.7) * 0.5 + 0.5;

    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,58,10,${0.07 + pulse * 0.025})`;
    ctx.lineWidth = 44;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,104,22,${0.09 + pulse * 0.03})`;
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,180,84,${0.13 + pulse * 0.05})`;
    ctx.lineWidth = 11;
    ctx.stroke();

    // flow: bright fissures crawling toward the core, thin enough to read as cracks
    if (!reduced) {
      ctx.setLineDash([48, 210]);
      ctx.lineDashOffset = -((t * 66) % 258);
      ctx.strokeStyle = "rgba(255,224,160,0.24)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.setLineDash([16, 360]);
      ctx.lineDashOffset = -((t * 124) % 376);
      ctx.strokeStyle = "rgba(255,252,225,0.34)";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawRift(ctx: CanvasRenderingContext2D, s: State, t: number, reduced: boolean): void {
    const { x, y } = s.path.rift;
    const rx = Math.max(6, x + 74);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = reduced ? 0.5 : Math.sin(t * 2.6) * 0.5 + 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(rx - 40, y, 22 + i * 16 + pulse * 6, 62 + i * 20 + pulse * 8, 0, 0, 6.284);
      ctx.strokeStyle = `rgba(150,210,255,${0.2 - i * 0.05})`;
      ctx.lineWidth = 5 - i;
      ctx.stroke();
    }
    blob(ctx, riftGlow(), rx - 46, y, 96, 0.4 + pulse * 0.18);
    ctx.restore();
  }

  private drawPlots(ctx: CanvasRenderingContext2D, s: State, o: DrawOpts, t: number): void {
    for (const plot of s.plots) {
      const isHover = plot.id === o.hoverPlot;
      const isSel = plot.id === o.selectedPlot;
      const empty = plot.towerId < 0;
      if (!isHover && !isSel && (!empty || o.hint <= 0)) continue;

      ctx.save();
      ctx.translate(plot.x, plot.y);
      ctx.rotate(plot.rot);
      const h = plot.size / 2;

      if (empty && o.hint > 0 && !isSel) {
        // the only tutorial in the game: good pads breathe until you use one
        const bp = o.reducedMotion ? 0.5 : Math.sin(t * 3 + plot.id) * 0.5 + 0.5;
        const a = o.hint * (0.12 + bp * 0.3) * (0.4 + plot.value * 3.4);
        ctx.strokeStyle = `rgba(255,196,110,${Math.min(0.75, a).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(-h + 2, -h + 2, plot.size - 4, plot.size - 4);
      }
      if (isHover || isSel) {
        ctx.fillStyle = isSel ? "rgba(255,180,90,0.22)" : "rgba(255,180,90,0.10)";
        ctx.fillRect(-h, -h, plot.size, plot.size);
        ctx.strokeStyle = isSel ? C.gold : "rgba(255,206,120,0.7)";
        ctx.lineWidth = isSel ? 4 : 2.5;
        ctx.strokeRect(-h + 2, -h + 2, plot.size - 4, plot.size - 4);
        // corner brackets — reads as a targeting reticle, not a table cell
        const L = 14;
        ctx.lineWidth = 4;
        ctx.strokeStyle = C.whiteHot;
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [-1, 1],
          [1, 1],
        ] as const) {
          ctx.beginPath();
          ctx.moveTo(sx * h - sx * L, sy * h);
          ctx.lineTo(sx * h, sy * h);
          ctx.lineTo(sx * h, sy * h - sy * L);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }

  private drawRanges(ctx: CanvasRenderingContext2D, s: State, o: DrawOpts): void {
    // an armed tower previews on whatever pad the cursor is over; otherwise the
    // selected pad wins
    const id =
      o.selectedPlot >= 0 ? o.selectedPlot : o.buildPreview ? o.hoverPlot : -1;
    const plot = s.plots[id];
    if (!plot) return;
    let range = 0;
    if (plot.towerId >= 0) {
      const tw = s.towers.find((q) => q.id === plot.towerId);
      if (tw) range = towerRange(tw.kind, tw.level);
    } else if (o.buildPreview) {
      range = towerRange(o.buildPreview, 0);
    }
    if (range <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(plot.x, plot.y, range, 0, 6.284);
    ctx.fillStyle = "rgba(255,170,70,0.07)";
    ctx.fill();
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = "rgba(255,206,120,0.55)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawCore(ctx: CanvasRenderingContext2D, s: State, t: number, reduced: boolean): void {
    const { x, y } = s.path.core;
    const frac = s.coreHp / 20;
    const pulse = reduced ? 0.5 : Math.sin(t * 2.2) * 0.5 + 0.5;
    ctx.save();
    ctx.translate(x, y);

    ctx.globalCompositeOperation = "lighter";
    const heat = 0.3 + frac * 0.45 + pulse * 0.1 + s.coreFlash * 0.4;
    blob(ctx, glows().deep, 0, 0, 150, heat * 0.8);
    blob(ctx, glows().white, 0, 0, 62, heat * 0.5);
    ctx.globalCompositeOperation = "source-over";

    // furnace housing
    const R = 54;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const px = Math.cos(a) * R;
      const py = Math.sin(a) * R;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#1a1215";
    ctx.fill();
    ctx.strokeStyle = s.coreFlash > 0.05 ? C.danger : "rgba(255,170,80,0.6)";
    ctx.lineWidth = 4 + s.coreFlash * 5;
    ctx.stroke();

    // grate bars, glowing hotter the healthier the forge
    ctx.strokeStyle = `rgba(255,${Math.round(90 + frac * 130)},${Math.round(20 + frac * 60)},${0.5 + frac * 0.4})`;
    ctx.lineWidth = 6;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-34, i * 15);
      ctx.lineTo(34, i * 15);
      ctx.stroke();
    }

    // damage: the housing fractures, visibly and permanently
    const cracks = Math.round((1 - frac) * 7);
    ctx.strokeStyle = "rgba(10,6,7,0.9)";
    ctx.lineWidth = 3.5;
    for (let i = 0; i < cracks; i++) {
      const a = (i / 7) * 6.284 + 0.6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.lineTo(Math.cos(a + 0.3) * R, Math.sin(a + 0.3) * R);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawEnemies(ctx: CanvasRenderingContext2D, s: State, t: number, reduced: boolean): void {
    for (const e of s.enemies) {
      if (!e.alive) continue;
      const age = t - e.born;
      // spawn squash: elastic settle, the cheapest and most valuable feel win
      let sx = 1;
      let sy = 1;
      if (age < 0.34 && !reduced) {
        const k = easeOutBack(clamp01(age / 0.34));
        sx = 0.42 + 0.58 * k + (1 - k) * 0.5;
        sy = 1.6 - 0.6 * k - (1 - k) * 0.5;
      }
      const ang = Math.atan2(e.dirY, e.dirX);
      // a walking squash: the single cheapest thing that stops them reading as
      // stickers sliding down a track
      if (!reduced && e.stun <= 0) {
        const bob = Math.sin(t * 7.5 + e.phase);
        sx *= 1 + bob * 0.06;
        sy *= 1 - bob * 0.06;
      }

      ctx.save();
      ctx.translate(e.x, e.y);

      // contact shadow grounds the piece; without it everything floats
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.ellipse(2, e.radius * 0.55, e.radius * 0.95, e.radius * 0.38, 0, 0, 6.284);
      ctx.fill();

      ctx.rotate(ang);
      ctx.scale(sx, sy);

      // a hit lightens the stone toward ice, it does not blank it to white —
      // under heavy fire a pure-white flash erases every silhouette on screen
      const f = Math.min(1, e.hitFlash / 0.11) * 0.72;
      const body = f > 0.02 ? mix(C.obsidian, "#dcefff", f) : C.obsidian;
      const facet = f > 0.02 ? mix(C.obsidianHi, "#ffffff", f) : C.obsidianHi;
      const edge = f > 0.02 ? "#ffffff" : C.rime;

      switch (e.kind) {
        case "runner":
          this.chevron(ctx, e.radius, body, facet, edge);
          break;
        case "brute":
          this.hex(ctx, e.radius, body, facet, edge, true);
          break;
        case "splitter":
          this.seamed(ctx, e.radius, body, facet, edge);
          break;
        case "warden":
          this.diamond(ctx, e.radius, body, facet, edge);
          break;
        case "boss":
          this.bossBody(ctx, e.radius, body, facet, edge, reduced ? 0 : t);
          break;
        default:
          this.diamond(ctx, e.radius, body, facet, edge);
      }
      ctx.restore();

      // the ward is a separate, obviously-different ring so it never reads as colour alone
      if (e.warded) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(reduced ? 0 : t * 2.2 + e.phase);
        ctx.strokeStyle = "rgba(111,227,255,0.85)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 8, (i * 6.284) / 3, (i * 6.284) / 3 + 1.3);
          ctx.stroke();
        }
        ctx.restore();
      }
      if (e.stun > 0) {
        ctx.save();
        ctx.translate(e.x, e.y - e.radius - 14);
        ctx.strokeStyle = "rgba(255,240,200,0.85)";
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * 6.284) / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * 9, Math.sin(a) * 4, 2.6, 0, 6.284);
          ctx.stroke();
        }
        ctx.restore();
      }

      // health: a bar only once hurt, so a fresh wave is not a wall of UI
      if (e.hp < e.maxHp) {
        const w = e.kind === "boss" ? 110 : Math.max(24, e.radius * 2.2);
        const frac = clamp01(e.hp / e.maxHp);
        const yy = e.y - e.radius - (e.kind === "boss" ? 26 : 12);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(e.x - w / 2 - 1, yy - 1, w + 2, 6);
        ctx.fillStyle = frac > 0.5 ? "#8fb4d8" : frac > 0.22 ? "#ffb648" : C.danger;
        ctx.fillRect(e.x - w / 2, yy, w * frac, 4);
      }
    }
  }

  private diamond(ctx: CanvasRenderingContext2D, r: number, body: string, facet: string, edge: string): void {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r * 0.82);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.82);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, -r * 0.82);
    ctx.lineTo(-r * 0.3, -r * 0.2);
    ctx.closePath();
    ctx.fillStyle = facet;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(0, r * 0.82);
    ctx.lineTo(-r, 0);
    ctx.lineTo(0, -r * 0.82);
    ctx.closePath();
    ctx.stroke();
  }

  private chevron(ctx: CanvasRenderingContext2D, r: number, body: string, facet: string, edge: string): void {
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r * 0.6, r * 0.85);
    ctx.lineTo(-r * 0.1, 0);
    ctx.lineTo(-r * 0.6, -r * 0.85);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r * 0.6, -r * 0.85);
    ctx.lineTo(-r * 0.1, 0);
    ctx.closePath();
    ctx.fillStyle = facet;
    ctx.fill();
  }

  private hex(
    ctx: CanvasRenderingContext2D,
    r: number,
    body: string,
    facet: string,
    edge: string,
    plated: boolean,
  ): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.9;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.stroke();
    if (plated) {
      // armour plating: the visual reason a bolt tower is useless here
      ctx.strokeStyle = facet;
      ctx.lineWidth = 3;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.42, -r * 0.55);
        ctx.lineTo(i * r * 0.42, r * 0.55);
        ctx.stroke();
      }
    }
  }

  private seamed(ctx: CanvasRenderingContext2D, r: number, body: string, facet: string, edge: string): void {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, 6.284);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.strokeStyle = facet;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.44, 0, 6.284);
    ctx.strokeStyle = facet;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private bossBody(
    ctx: CanvasRenderingContext2D,
    r: number,
    body: string,
    facet: string,
    edge: string,
    t: number,
  ): void {
    ctx.save();
    ctx.rotate(t * 0.4);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (6.284 / 12) * i;
      const rr = i % 2 === 0 ? r : r * 0.62;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, 6.284);
    ctx.fillStyle = facet;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, 6.284);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawTowers(ctx: CanvasRenderingContext2D, s: State, t: number, o: DrawOpts): void {
    for (const tw of s.towers) {
      const age = t - tw.bornAt;
      const pop = age < 0.4 ? easeOutBack(clamp01(age / 0.4)) : 1;
      const kick = tw.recoil * tw.recoil;
      ctx.save();
      ctx.translate(tw.x - Math.cos(tw.angle) * kick * 7, tw.y - Math.sin(tw.angle) * kick * 7);
      const sc = pop * (1 + kick * 0.19);
      ctx.scale(sc, sc);

      // heat halo: charge is visible, so fire rate needs no label
      const heat = clamp01(tw.heat);
      ctx.globalCompositeOperation = "lighter";
      blob(ctx, glows().hot, 0, 0, 54, 0.14 + heat * 0.42);
      ctx.globalCompositeOperation = "source-over";

      // a seated base ring gives the machine weight and hides the socket edge
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, 6.284);
      ctx.fillStyle = "#150e11";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,166,80,0.28)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.rotate(tw.angle + Math.PI / 2);
      const hot = `rgb(${Math.round(120 + heat * 135)},${Math.round(44 + heat * 190)},${Math.round(16 + heat * 190)})`;

      if (tw.kind === "bolt") this.boltBody(ctx, tw.level, hot);
      else if (tw.kind === "mortar") this.mortarBody(ctx, tw.level, hot);
      else this.chainBody(ctx, tw.level, hot, o.reducedMotion ? 0 : t);

      ctx.restore();

      // level pips read as count, not colour
      if (tw.level > 0) {
        ctx.save();
        ctx.translate(tw.x, tw.y + 36);
        for (let i = 0; i <= tw.level; i++) {
          ctx.beginPath();
          ctx.arc((i - tw.level / 2) * 9, 0, 3, 0, 6.284);
          ctx.fillStyle = C.gold;
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /**
   * Three machines with fixed silhouettes. Level never changes the outline —
   * it lights the core and adds pips — because a board of twenty towers has to
   * stay readable at a glance, and a growing shape overruns its pad.
   */
  private boltBody(ctx: CanvasRenderingContext2D, level: number, hot: string): void {
    const glow = 0.4 + level * 0.15;
    ctx.fillStyle = "#241a1b";
    ctx.beginPath();
    ctx.moveTo(-13, 11);
    ctx.lineTo(13, 11);
    ctx.lineTo(9, -7);
    ctx.lineTo(-9, -7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,180,96,${glow.toFixed(2)})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.fillStyle = "#120d0e";
    ctx.fillRect(-4, -29, 8, 24);
    ctx.strokeStyle = hot;
    ctx.lineWidth = 2;
    ctx.strokeRect(-4, -29, 8, 24);

    ctx.beginPath();
    ctx.arc(0, -29, 4.2, 0, 6.284);
    ctx.fillStyle = hot;
    ctx.fill();

    // fins: the only thing that changes with level, and it is a count
    ctx.strokeStyle = hot;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < Math.min(3, 1 + Math.floor(level / 2)); i++) {
      const y = 2 - i * 6;
      ctx.beginPath();
      ctx.moveTo(-14 - i, y);
      ctx.lineTo(-9, y);
      ctx.moveTo(14 + i, y);
      ctx.lineTo(9, y);
      ctx.stroke();
    }
  }

  private mortarBody(ctx: CanvasRenderingContext2D, level: number, hot: string): void {
    const glow = 0.4 + level * 0.15;
    // treads
    ctx.fillStyle = "#191213";
    ctx.fillRect(-21, -6, 6, 24);
    ctx.fillRect(15, -6, 6, 24);
    ctx.strokeStyle = `rgba(255,180,96,${(glow * 0.7).toFixed(2)})`;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-21, -6, 6, 24);
    ctx.strokeRect(15, -6, 6, 24);

    ctx.fillStyle = "#241a1b";
    ctx.fillRect(-15, -8, 30, 24);
    ctx.strokeStyle = `rgba(255,180,96,${glow.toFixed(2)})`;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(-15, -8, 30, 24);

    // a fat stubby barrel — reads as heavy from any distance
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(8, -6);
    ctx.lineTo(7, -26);
    ctx.lineTo(-7, -26);
    ctx.closePath();
    ctx.fillStyle = "#120d0e";
    ctx.fill();
    ctx.strokeStyle = hot;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, -26, 6.5, 0, 6.284);
    ctx.strokeStyle = hot;
    ctx.lineWidth = 3;
    ctx.stroke();

    for (let i = 0; i < Math.min(4, level + 1); i++) {
      ctx.fillStyle = hot;
      ctx.fillRect(-12 + i * 7, 8, 4, 5);
    }
  }

  private chainBody(ctx: CanvasRenderingContext2D, level: number, hot: string, t: number): void {
    const glow = 0.4 + level * 0.15;
    const r = 18;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#241a1b";
    ctx.fill();
    ctx.strokeStyle = `rgba(255,180,96,${glow.toFixed(2)})`;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, 6.284);
    ctx.strokeStyle = hot;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    const nodes = 3 + Math.floor(level / 2);
    ctx.save();
    ctx.rotate(t * 1.5);
    for (let i = 0; i < nodes; i++) {
      const a = (6.284 / nodes) * i;
      const nx = Math.cos(a) * 14;
      const ny = Math.sin(a) * 14;
      ctx.beginPath();
      ctx.arc(nx, ny, 3.4, 0, 6.284);
      ctx.fillStyle = hot;
      ctx.fill();
    }
    ctx.restore();
  }

  private drawOrdnance(ctx: CanvasRenderingContext2D, s: State): void {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    for (const sh of s.shots) {
      if (!sh.alive) continue;
      // tapered ribbon from the position history
      for (let i = sh.trailN - 1; i > 0; i--) {
        const x0 = sh.trail[i * 2] as number;
        const y0 = sh.trail[i * 2 + 1] as number;
        const x1 = sh.trail[(i - 1) * 2] as number;
        const y1 = sh.trail[(i - 1) * 2 + 1] as number;
        const a = (1 - i / sh.trailN) * 0.55;
        ctx.strokeStyle = sh.kind === "bolt" ? `rgba(255,206,120,${a})` : `rgba(255,140,50,${a})`;
        ctx.lineWidth = (sh.kind === "bolt" ? 5 : 9) * (1 - i / sh.trailN);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.kind === "bolt" ? 4.6 : 8, 0, 6.284);
      ctx.fillStyle = C.whiteHot;
      ctx.fill();
      blob(ctx, glows().hot, sh.x, sh.y, sh.kind === "bolt" ? 16 : 28, 0.5);
    }

    for (const a of s.arcs) {
      const k = a.life / a.maxLife;
      ctx.strokeStyle = `rgba(190,236,255,${(k * 0.9).toFixed(3)})`;
      ctx.lineWidth = 2 + k * 5;
      ctx.beginPath();
      for (let i = 0; i + 1 < a.pts.length; i += 2) {
        const x = a.pts[i] as number;
        const y = a.pts[i + 1] as number;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${(k * 0.8).toFixed(3)})`;
      ctx.lineWidth = 1 + k * 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, p: Particles, additive: boolean): void {
    ctx.save();
    ctx.globalCompositeOperation = additive ? "lighter" : "source-over";
    const n = p.count;
    for (let i = 0; i < n; i++) {
      const kind = p.kind[i] as number;
      const isAdd = kind === PKind.Spark || kind === PKind.Ring || kind === PKind.Ember || kind === PKind.Bolt;
      if (isAdd !== additive) continue;
      const life = (p.life[i] as number) / (p.maxLife[i] as number);
      const x = p.x[i] as number;
      const y = p.y[i] as number;
      const sz = p.size[i] as number;
      const hue = p.hue[i] as number;

      if (kind === PKind.Spark) {
        // three discrete sprites read as a cooling ember, and cost one blit each
        const g = glows();
        const sprite = life > 0.62 ? g.white : life > 0.3 ? g.hot : g.deep;
        blob(ctx, sprite, x, y, sz * (0.9 + life * 1.5), life * life);
      } else if (kind === PKind.Ember) {
        blob(ctx, hue > 0.5 ? glows().white : glows().hot, x, y, sz * 2.4, life * 0.6);
      } else if (kind === PKind.Ring) {
        const grow = 1 - life;
        ctx.strokeStyle = `rgba(255,${Math.round(190 + hue * 50)},${Math.round(140 + hue * 80)},${(life * life * 0.8).toFixed(3)})`;
        ctx.lineWidth = 2 + life * 9;
        ctx.beginPath();
        ctx.arc(x, y, sz * easeOutCubic(grow), 0, 6.284);
        ctx.stroke();
      } else if (kind === PKind.Shard) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.rot[i] as number);
        ctx.fillStyle = `rgba(${Math.round(40 + hue * 40)},${Math.round(56 + hue * 40)},${Math.round(76 + hue * 40)},${clamp01(life * 1.5).toFixed(3)})`;
        ctx.fillRect(-sz / 2, -sz / 2, sz, sz * 0.7);
        ctx.restore();
      } else if (kind === PKind.Smoke) {
        const grow = 1 + (1 - life) * 1.5;
        ctx.fillStyle = `rgba(${Math.round(24 + hue * 20)},${Math.round(18 + hue * 14)},${Math.round(20 + hue * 14)},${(life * 0.34).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, sz * grow, 0, 6.284);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawPopups(ctx: CanvasRenderingContext2D, s: State): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const p of s.popups) {
      if (!p.alive) continue;
      const k = p.life / p.maxLife;
      const size = (p.big ? 42 : 26) * (1 + (1 - k) * 0.18);
      ctx.font = font(size);
      ctx.globalAlpha = clamp01(k * 1.6);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.tone === 1 ? C.gold : p.tone === 2 ? C.danger : "#ffe4bb";
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export function towerLabel(kind: TowerKind): string {
  return TOWERS[kind].name;
}
