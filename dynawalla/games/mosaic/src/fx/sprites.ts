/**
 * Pre-rendered sprites.
 *
 * Canvas2D gradients and `shadowBlur` are the two reliable ways to lose a frame
 * budget, so neither is ever used per-object per-frame. Every tile face, glow
 * and halo is rasterised once into an offscreen canvas at construction (and on
 * resize) and drawn back with a single `drawImage`.
 *
 * The tile face is deliberately *luminous*: real stained glass is lit from
 * behind, and dark numerals on bright glass is also the highest-contrast way to
 * put a number on top of six different hues.
 */
import { JEWELS, INK } from "./palette.ts";

export const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

/** Extra margin baked into every tile sprite so its light can spill outward. */
export const TILE_BLEED = 10;

function surface(w: number, h: number, dpr: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w * dpr));
  c.height = Math.max(1, Math.ceil(h * dpr));
  const g = c.getContext("2d")!;
  g.scale(dpr, dpr);
  return { c, g };
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export class Sprites {
  /** [colour][0]=plain [1]=star [2]=crystal */
  tiles: HTMLCanvasElement[][] = [];
  /** Radial glows, one per jewel plus [JEWELS.length] = warm white. */
  glows: HTMLCanvasElement[] = [];
  ballHalo!: HTMLCanvasElement;
  paddleBody!: HTMLCanvasElement;
  paddleWide!: HTMLCanvasElement;

  cellW = 0;
  cellH = 0;
  private dpr = 1;

  build(cellW: number, cellH: number, dpr: number): void {
    if (this.cellW === cellW && this.cellH === cellH && this.dpr === dpr) return;
    this.cellW = cellW;
    this.cellH = cellH;
    this.dpr = dpr;
    // Three hand-cut variants of the common tile so no two neighbours share an
    // outline. A grid of identical rounded rectangles is what makes a wall read
    // as UI buttons; irregular tesserae read as glass someone cut.
    this.tiles = JEWELS.map((_, i) => [
      this.tile(i, "glass", cellW, cellH, dpr, 0),
      this.tile(i, "star", cellW, cellH, dpr, 0),
      this.tile(i, "crystal", cellW, cellH, dpr, 0),
      this.tile(i, "glass", cellW, cellH, dpr, 1),
      this.tile(i, "glass", cellW, cellH, dpr, 2),
    ]);
    if (!this.glows.length) {
      this.glows = [...JEWELS.map((j) => this.glow(j.glow, dpr)), this.glow("#fff2d6", dpr)];
      this.ballHalo = this.glow("#ffd98a", dpr, 96);
    }
    this.paddleBody = this.paddle(168, 21, dpr);
    this.paddleWide = this.paddle(168 * 1.72, 21, dpr);
  }

  private tile(ci: number, kind: string, w: number, h: number, dpr: number, variant: number): HTMLCanvasElement {
    const j = JEWELS[ci]!;
    // The sprite is drawn oversized so the halo of transmitted light can bleed
    // past the tile's own cell, which is what makes the wall look *lit* rather
    // than painted. `TILE_BLEED` is added on every side.
    const bleed = TILE_BLEED;
    const pad = 3 + bleed;
    const { c, g } = surface(w + bleed * 2, h + bleed * 2, dpr);
    const iw = w - 6;
    const ih = h - 6;
    const r = 3.5;

    // Transmitted light: a soft halo of the glass colour spilling out of the
    // came, as if the tile is a hole in a wall with a furnace behind it.
    const halo = g.createRadialGradient(
      pad + iw / 2,
      pad + ih / 2,
      ih * 0.2,
      pad + iw / 2,
      pad + ih / 2,
      Math.max(iw, ih) * 0.95,
    );
    halo.addColorStop(0, hexA(j.glow, 0.5));
    halo.addColorStop(0.55, hexA(j.glow, 0.14));
    halo.addColorStop(1, hexA(j.glow, 0));
    g.fillStyle = halo;
    g.fillRect(0, 0, w + bleed * 2, h + bleed * 2);

    // Leading — the dark came around every piece of glass. Heavy on purpose:
    // real stained glass is mostly lead, and it is what stops six saturated
    // hues next to each other from turning into mush.
    tessera(g, pad - 2.6, pad - 2.6, iw + 5.2, ih + 5.2, variant);
    g.fillStyle = "rgba(4,3,10,0.95)";
    g.fill();

    // A hot rim of leaked light just inside the came — this single detail is
    // the difference between "backlit glass" and "a coloured button".
    tessera(g, pad - 1.2, pad - 1.2, iw + 2.4, ih + 2.4, variant);
    g.fillStyle = j.glow;
    g.fill();

    // Body: lit from behind, so the top is hotter than the bottom.
    const grad = g.createLinearGradient(pad, pad, pad, pad + ih);
    grad.addColorStop(0, j.glass);
    grad.addColorStop(0.55, j.glass);
    grad.addColorStop(1, j.lo);
    tessera(g, pad, pad, iw, ih, variant);
    g.fillStyle = grad;
    g.fill();

    g.save();
    tessera(g, pad, pad, iw, ih, variant);
    g.clip();

    // A hot core, because the light source is behind the glass.
    const core = g.createRadialGradient(
      pad + iw * 0.42,
      pad + ih * 0.38,
      0,
      pad + iw * 0.42,
      pad + ih * 0.38,
      iw * 0.8,
    );
    core.addColorStop(0, hexA(j.hi, 0.34));
    core.addColorStop(0.55, hexA(j.hi, 0.08));
    core.addColorStop(1, hexA(j.hi, 0));
    g.fillStyle = core;
    g.fillRect(pad, pad, iw, ih);

    // One narrow cut, not a gloss sweep. Plastic buttons have big soft
    // highlights; glass has a thin bright edge where the cut catches.
    g.globalAlpha = 0.16;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(pad + iw * 0.1, pad);
    g.lineTo(pad + iw * 0.3, pad);
    g.lineTo(pad, pad + ih * 0.62);
    g.lineTo(pad, pad + ih * 0.2);
    g.closePath();
    g.fill();
    g.globalAlpha = 0.26;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(pad + iw * 0.3, pad);
    g.lineTo(pad, pad + ih * 0.62);
    g.stroke();
    g.globalAlpha = 1;

    if (kind === "crystal") {
      // Twice as thick: an inner frame you have to break through.
      g.strokeStyle = "rgba(255,255,255,0.72)";
      g.lineWidth = 2.4;
      roundRect(g, pad + iw * 0.13, pad + ih * 0.16, iw * 0.74, ih * 0.68, r * 0.6);
      g.stroke();
    }
    if (kind === "star") {
      // A radiant mark: this one takes its guilty neighbours with it.
      g.globalCompositeOperation = "lighter";
      g.fillStyle = "rgba(255,246,214,0.85)";
      const cx = pad + iw / 2;
      const cy = pad + ih / 2;
      const R = Math.min(iw, ih) * 0.56;
      g.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 === 0 ? R : R * 0.3;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.8;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.globalAlpha = 0.5;
      g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    g.restore();

    // Bevel.
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(pad + r, pad + 0.9);
    g.lineTo(pad + iw - r, pad + 0.9);
    g.stroke();
    g.strokeStyle = "rgba(0,0,0,0.34)";
    g.beginPath();
    g.moveTo(pad + r, pad + ih - 0.9);
    g.lineTo(pad + iw - r, pad + ih - 0.9);
    g.stroke();

    return c;
  }

  private glow(colour: string, dpr: number, size = 128): HTMLCanvasElement {
    const { c, g } = surface(size, size, dpr);
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, colour);
    grad.addColorStop(0.28, hexA(colour, 0.5));
    grad.addColorStop(1, hexA(colour, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  }

  private paddle(w: number, h: number, dpr: number): HTMLCanvasElement {
    const pad = 8;
    const { c, g } = surface(w + pad * 2, h + pad * 2, dpr);
    const x = pad;
    const y = pad;
    const r = h / 2.6;

    roundRect(g, x, y, w, h, r);
    const grad = g.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "#fff6e2");
    grad.addColorStop(0.34, "#f5d79b");
    grad.addColorStop(1, "#8d6a2c");
    g.fillStyle = grad;
    g.fill();

    // The lens tells you what it does: the ends are angled, the centre is flat.
    g.globalAlpha = 0.35;
    g.fillStyle = "#2a1a06";
    g.beginPath();
    g.moveTo(x + w * 0.12, y + h);
    g.lineTo(x, y + h);
    g.lineTo(x, y + h * 0.4);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(x + w * 0.88, y + h);
    g.lineTo(x + w, y + h);
    g.lineTo(x + w, y + h * 0.4);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x + r, y + 1);
    g.lineTo(x + w - r, y + 1);
    g.stroke();
    return c;
  }
}

/**
 * A hand-cut tessera outline: a quad with each corner nudged and each edge
 * bowed a little. Deterministic per variant so the atlas stays cacheable.
 */
const CUTS: number[][] = [
  [0.02, 0.06, -0.03, 0.04, 0.03, -0.05, -0.02, -0.04],
  [-0.04, -0.05, 0.02, 0.07, -0.02, 0.05, 0.04, -0.06],
  [0.03, -0.04, -0.05, -0.03, 0.04, 0.06, -0.03, 0.05],
];

function tessera(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, variant: number): void {
  const k = CUTS[variant % CUTS.length]!;
  const jx = Math.min(4.5, w * 0.06);
  const jy = Math.min(3.5, h * 0.09);
  const p = [
    [x + k[0]! * jx * 6, y + k[1]! * jy * 6],
    [x + w + k[2]! * jx * 6, y + k[3]! * jy * 6],
    [x + w + k[4]! * jx * 6, y + h + k[5]! * jy * 6],
    [x + k[6]! * jx * 6, y + h + k[7]! * jy * 6],
  ];
  g.beginPath();
  g.moveTo(p[0]![0]!, p[0]![1]!);
  for (let i = 0; i < 4; i++) {
    const a = p[i]!;
    const b = p[(i + 1) % 4]!;
    // Bow each edge outward or inward by a hair so nothing is a straight line.
    const mx = (a[0]! + b[0]!) / 2 + (i % 2 === 0 ? 0 : k[i]! * jx * 3);
    const my = (a[1]! + b[1]!) / 2 + (i % 2 === 0 ? k[i]! * jy * 3 : 0);
    g.quadraticCurveTo(mx, my, b[0]!, b[1]!);
  }
  g.closePath();
}

/** `#rrggbb` + alpha -> rgba(). Only ever called at build time. */
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (m) => m + m) : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export { roundRect, INK };
