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

/**
 * Ink extent of a label, in CSS pixels: the glyphs and nothing else.
 *
 * `labelWidth` is the width of the *canvas* a label rasterises into, and that
 * canvas is mostly transparent — `pad` is `0.28em` on every side and the plain
 * box is `1.34em` tall for glyphs whose ink is `CAP_EM`. Measuring a fit
 * against the padded box makes a label that would sit comfortably read as too
 * big by roughly a third at each edge, and a fit that is wrong in the safe
 * direction still shrinks type a child has to read.
 *
 * So: fits are measured here, blits are still positioned by `labelWidth`. The
 * two are deliberately different numbers and the doc comment on each says which.
 */
export type Ink = { w: number; h: number };

/**
 * Ink height of one plain line, in ems.
 *
 * Every glyph a condition or an orb is written with — the ten digits, `+`,
 * U+2212, `×`, `÷`, `=`, `<`, `>`, U+25A1 — sits on the baseline with no
 * descender, so this is a cap height and not an em box. A prompt that grew a
 * lowercase letter would need this raised, which is why it is a named constant
 * with this comment on it rather than a number inside an expression.
 *
 * Measured, not chosen: `FONT_STACK` at `800 100px` in a Chromium on macOS gives
 * `actualBoundingBoxAscent + Descent` of **74.8px** for `8` and **74.6px** for
 * U+25A1. 0.75 rounds that up, so the fit never underestimates a height.
 */
export const CAP_EM = 0.75;

const inkCache = new Map<string, Ink>();

function font(style: LabelStyle, size: number): string {
  return `${style.weight} ${size}px ${FONT_STACK}`;
}

/** Advance width of `text` at `size`, in CSS pixels. Linear in `size`. */
function advance(text: string, style: LabelStyle, size: number): number {
  const m = measureCtx();
  m.font = font(style, size);
  return m.measureText(text).width;
}

/**
 * The ink `text` would occupy at `style.size`. See `Ink`.
 *
 * Mirrors `render()` branch for branch: a bare `a/b` is a stacked fraction and is
 * therefore short and tall, everything else is one line of `size * CAP_EM`.
 */
export function labelInk(text: string, style: LabelStyle): Ink {
  const key = `${text}|${Math.round(style.size * 4)}|${style.weight}|${style.tracking}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  if (inkCache.size > MAX_ENTRIES) inkCache.clear();

  const frac = FRACTION.exec(text);
  let made: Ink;
  if (frac) {
    const partSize = style.size * 0.62;
    const top = advance(frac[1] as string, style, partSize);
    const bot = advance(frac[2] as string, style, partSize);
    // `render()` draws the bar at 1.5x the wider numeral, so the bar is the ink.
    made = { w: Math.max(top, bot) * 1.5, h: partSize * 2.35 };
  } else {
    const run = advance(text, style, style.size) + style.tracking * Math.max(0, text.length - 1);
    made = { w: run, h: style.size * CAP_EM };
  }
  inkCache.set(key, made);
  return made;
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

/**
 * Width of the CANVAS a label rasterises into, padding included.
 *
 * This is the number to position a blit with. It is NOT the number to fit
 * against — see `labelInk`.
 */
export function labelWidth(text: string, style: LabelStyle, dpr: number): number {
  return label(text, style, dpr).w;
}

export function clearGlyphCache(): void {
  cache.clear();
  inkCache.clear();
}
