import { font, rgb, shade, type Rgb } from "./palette.ts";

/**
 * Everything expensive is rasterised once and blitted forever.
 *
 * No `shadowBlur`, no `filter`, no per-frame gradient construction in the hot
 * path — those are what actually cost frames in Canvas2D. Glows are pre-blurred
 * radial sprites drawn with `lighter`; chips and numerals are cached bitmaps.
 * The cache is keyed by everything that affects the pixels, and cleared on
 * resize (which is the only time the device pixel ratio can change).
 */

type Canvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

function ctxOf(c: Canvas): CanvasRenderingContext2D {
  return c.getContext("2d") as unknown as CanvasRenderingContext2D;
}

export class SpriteCache {
  private glows = new Map<string, Canvas>();
  private chips = new Map<string, Canvas>();
  private texts = new Map<string, { c: Canvas; w: number; h: number }>();
  private textOrder: string[] = [];
  dpr = 1;

  reset(dpr: number): void {
    this.dpr = dpr;
    this.glows.clear();
    this.chips.clear();
    this.texts.clear();
    this.textOrder = [];
  }

  /** Soft additive blob. Draw with globalCompositeOperation = "lighter". */
  glow(c: Rgb, size: number, softness = 1): Canvas {
    const px = Math.max(8, Math.round(size * this.dpr));
    const key = `${c[0]},${c[1]},${c[2]}|${px}|${softness}`;
    const hit = this.glows.get(key);
    if (hit) return hit;
    const cv = makeCanvas(px, px);
    const g = ctxOf(cv);
    const r = px / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    // A gaussian-ish falloff. Four stops is enough and stays cheap to build.
    grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${0.95 / softness})`);
    grad.addColorStop(0.28, `rgba(${c[0]},${c[1]},${c[2]},${0.42 / softness})`);
    grad.addColorStop(0.6, `rgba(${c[0]},${c[1]},${c[2]},${0.12 / softness})`);
    grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, px, px);
    this.glows.set(key, cv);
    return cv;
  }

  /**
   * A reactor cell: a cut-cornered octagon, dark tinted interior, bright rim,
   * with an inner bevel highlight so it reads as a solid object under light.
   */
  chip(c: Rgb, size: number, hot: boolean): Canvas {
    const px = Math.max(8, Math.round(size * this.dpr));
    const key = `${c[0]},${c[1]},${c[2]}|${px}|${hot ? 1 : 0}`;
    const hit = this.chips.get(key);
    if (hit) return hit;
    const cv = makeCanvas(px, px);
    const g = ctxOf(cv);
    const s = px;
    const cut = s * 0.22;

    const path = () => {
      g.beginPath();
      g.moveTo(cut, 0);
      g.lineTo(s - cut, 0);
      g.lineTo(s, cut);
      g.lineTo(s, s - cut);
      g.lineTo(s - cut, s);
      g.lineTo(cut, s);
      g.lineTo(0, s - cut);
      g.lineTo(0, cut);
      g.closePath();
    };

    // interior: a vertical gradient from tinted dark to almost black
    path();
    const inner = g.createLinearGradient(0, 0, 0, s);
    const top = shade(c, hot ? 0.62 : 0.3);
    const bot = shade(c, hot ? 0.2 : 0.09);
    inner.addColorStop(0, `rgb(${top[0]},${top[1]},${top[2]})`);
    inner.addColorStop(1, `rgb(${bot[0]},${bot[1]},${bot[2]})`);
    g.fillStyle = inner;
    g.fill();

    // bevel: a bright sliver along the top-left edge
    g.save();
    path();
    g.clip();
    g.globalCompositeOperation = "lighter";
    const bev = g.createLinearGradient(0, 0, s * 0.7, s * 0.7);
    bev.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${hot ? 0.55 : 0.3})`);
    bev.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = bev;
    g.fillRect(0, 0, s, s);
    g.restore();

    // rim
    g.lineWidth = Math.max(1.5, s * 0.055);
    g.strokeStyle = rgb(c, hot ? 1 : 0.92);
    path();
    g.stroke();

    // inner hairline, inset — reads as thickness
    g.save();
    g.translate(s / 2, s / 2);
    g.scale(0.86, 0.86);
    g.translate(-s / 2, -s / 2);
    g.lineWidth = Math.max(1, s * 0.022);
    g.strokeStyle = rgb(c, hot ? 0.5 : 0.22);
    path();
    g.stroke();
    g.restore();

    this.chips.set(key, cv);
    return cv;
  }

  /** Rasterised text. LRU-capped because expression faces are unbounded. */
  text(str: string, px: number, c: Rgb, weight = 800): { c: Canvas; w: number; h: number } {
    const size = Math.max(6, Math.round(px * this.dpr));
    const key = `${str}|${size}|${weight}|${c[0]},${c[1]},${c[2]}`;
    const hit = this.texts.get(key);
    if (hit) return hit;

    const probe = makeCanvas(4, 4);
    const pg = ctxOf(probe);
    pg.font = font(size, weight);
    const m = pg.measureText(str);
    const w = Math.ceil(m.width) + Math.ceil(size * 0.5);
    const h = Math.ceil(size * 1.5);

    const cv = makeCanvas(w, h);
    const g = ctxOf(cv);
    g.font = font(size, weight);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = rgb(c);
    g.fillText(str, w / 2, h / 2);

    const entry = { c: cv, w: w / this.dpr, h: h / this.dpr };
    this.texts.set(key, entry);
    this.textOrder.push(key);
    if (this.textOrder.length > 420) {
      const dead = this.textOrder.shift();
      if (dead) this.texts.delete(dead);
    }
    return entry;
  }

  /** Draw a cached text bitmap centred on (x, y) at CSS pixels. */
  drawText(
    g: CanvasRenderingContext2D,
    str: string,
    px: number,
    c: Rgb,
    x: number,
    y: number,
    weight = 800,
    alpha = 1,
  ): void {
    const t = this.text(str, px, c, weight);
    if (alpha !== 1) g.globalAlpha = alpha;
    g.drawImage(t.c as CanvasImageSource, x - t.w / 2, y - t.h / 2, t.w, t.h);
    if (alpha !== 1) g.globalAlpha = 1;
  }

  measure(str: string, px: number): number {
    return this.text(str, px, [255, 255, 255]).w;
  }

  stats(): { glows: number; chips: number; texts: number } {
    return { glows: this.glows.size, chips: this.chips.size, texts: this.texts.size };
  }
}

/** Cut-cornered octagon path, for things drawn live (the well, the gauge). */
export function chipPath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
): void {
  g.beginPath();
  g.moveTo(x + cut, y);
  g.lineTo(x + w - cut, y);
  g.lineTo(x + w, y + cut);
  g.lineTo(x + w, y + h - cut);
  g.lineTo(x + w - cut, y + h);
  g.lineTo(x + cut, y + h);
  g.lineTo(x, y + h - cut);
  g.lineTo(x, y + cut);
  g.closePath();
}
