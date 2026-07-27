/**
 * Cached text.
 *
 * Numbers are the most important pixels in this game, so they get their own
 * pipeline: every label is rasterised once into a small canvas — dark outline
 * under a bright fill, so it stays readable over a bloom, a body, or the rim —
 * and then blitted. `a/b` is drawn as a real stacked fraction with a bar,
 * because `3/4` written inline is the notation of a spreadsheet, not of maths.
 */

import { FONT_STACK } from "../tuning.ts";

type Cached = { canvas: HTMLCanvasElement; w: number; h: number; dpr: number };

const cache = new Map<string, Cached>();
const MAX_ENTRIES = 420;

let measurer: CanvasRenderingContext2D | null = null;

function measureCtx(): CanvasRenderingContext2D {
  if (measurer) return measurer;
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const g = c.getContext("2d");
  if (!g) throw new Error("no 2d context");
  measurer = g;
  return g;
}

const FRACTION = /^(-?\d+)\/(\d+)$/;

export type LabelStyle = {
  /** Cap height in CSS pixels. */
  size: number;
  fill: string;
  outline: string;
  outlineWidth: number;
  weight: number;
  tracking: number;
};

function font(style: LabelStyle, size: number): string {
  return `${style.weight} ${size}px ${FONT_STACK}`;
}

function render(text: string, style: LabelStyle, dpr: number): Cached {
  const m = measureCtx();
  const frac = FRACTION.exec(text);
  const pad = Math.ceil(style.outlineWidth * 2 + style.size * 0.28);

  let w: number;
  let h: number;
  let partSize = style.size;

  if (frac) {
    partSize = style.size * 0.62;
    m.font = font(style, partSize);
    const top = m.measureText(frac[1] as string).width;
    const bot = m.measureText(frac[2] as string).width;
    w = Math.max(top, bot) * 1.5 + pad * 2;
    h = partSize * 2.35 + pad * 2;
  } else {
    m.font = font(style, style.size);
    const tw = m.measureText(text).width + style.tracking * Math.max(0, text.length - 1);
    w = tw + pad * 2;
    h = style.size * 1.34 + pad * 2;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.ceil(w * dpr));
  canvas.height = Math.max(2, Math.ceil(h * dpr));
  const g = canvas.getContext("2d");
  if (!g) throw new Error("no 2d context");
  g.scale(dpr, dpr);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.miterLimit = 2;

  const cx = w / 2;
  const cy = h / 2;

  const stroke = (s: string, x: number, y: number): void => {
    if (style.outlineWidth > 0) {
      g.lineWidth = style.outlineWidth * 2;
      g.strokeStyle = style.outline;
      g.strokeText(s, x, y);
    }
    g.fillStyle = style.fill;
    g.fillText(s, x, y);
  };

  if (frac) {
    g.font = font(style, partSize);
    const barW = w - pad * 1.4;
    stroke(frac[1] as string, cx, cy - partSize * 0.66);
    stroke(frac[2] as string, cx, cy + partSize * 0.72);
    if (style.outlineWidth > 0) {
      g.strokeStyle = style.outline;
      g.lineWidth = Math.max(2, partSize * 0.13) + style.outlineWidth * 2;
      g.beginPath();
      g.moveTo(cx - barW / 2, cy);
      g.lineTo(cx + barW / 2, cy);
      g.stroke();
    }
    g.strokeStyle = style.fill;
    g.lineCap = "round";
    g.lineWidth = Math.max(1.6, partSize * 0.11);
    g.beginPath();
    g.moveTo(cx - barW / 2, cy);
    g.lineTo(cx + barW / 2, cy);
    g.stroke();
  } else if (style.tracking !== 0) {
    g.font = font(style, style.size);
    const total = m.measureText(text).width + style.tracking * (text.length - 1);
    let x = cx - total / 2;
    for (const ch of text) {
      const cw = m.measureText(ch).width;
      stroke(ch, x + cw / 2, cy);
      x += cw + style.tracking;
    }
  } else {
    g.font = font(style, style.size);
    stroke(text, cx, cy);
  }

  return { canvas, w, h, dpr };
}

export function label(text: string, style: LabelStyle, dpr: number): Cached {
  const key = `${text}|${Math.round(style.size * 2)}|${style.fill}|${style.outline}|${style.outlineWidth}|${style.weight}|${style.tracking}|${dpr}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next();
    if (!first.done) cache.delete(first.value);
  }
  const made = render(text, style, dpr);
  cache.set(key, made);
  return made;
}

/** Draw a cached label centred on (x, y), optionally scaled and faded. */
export function drawLabel(
  g: CanvasRenderingContext2D,
  text: string,
  style: LabelStyle,
  x: number,
  y: number,
  dpr: number,
  scale = 1,
  alpha = 1,
): void {
  if (alpha <= 0.004) return;
  const c = label(text, style, dpr);
  const w = c.w * scale;
  const h = c.h * scale;
  const prev = g.globalAlpha;
  g.globalAlpha = prev * alpha;
  g.drawImage(c.canvas, x - w / 2, y - h / 2, w, h);
  g.globalAlpha = prev;
}

export function labelWidth(text: string, style: LabelStyle, dpr: number): number {
  return label(text, style, dpr).w;
}

export function clearGlyphCache(): void {
  cache.clear();
}
