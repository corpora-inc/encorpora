/**
 * Canvas-generated textures. Nothing is fetched; nothing is shipped.
 *
 * The hard lesson this file exists to obey: NEVER LET ORNAMENT EAT LEGIBILITY.
 * A value the player has under half a second to read is drawn as a heavy
 * geometric sans on a solid plate, at a fixed world size so it is the same
 * number of screen pixels whether it is at the top of the tower or eight
 * courses down. No engraving, no serifs, no texture behind a glyph.
 */

import { CanvasTexture, LinearFilter, SRGBColorSpace, Texture } from "three";

const FONT =
  '800 <SZ>px ui-sans-serif, -apple-system, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const W = 256;
const H = 128;

const numerals = new Map<string, CanvasTexture>();
const order: string[] = [];

/** White glyph on transparent, so the material can tint it per state. */
export function numeralTexture(value: string): Texture {
  const hit = numerals.get(value);
  if (hit) return hit;

  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, W, H);
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";

  let size = 92;
  const pad = 18;
  const setFont = (s: number): void => {
    g.font = FONT.replace("<SZ>", String(s));
  };
  setFont(size);
  // Shrink to fit rather than clip. A three-character fraction must still read.
  let m = g.measureText(value);
  while (m.width > W - pad * 2 && size > 30) {
    size -= 4;
    setFont(size);
    m = g.measureText(value);
  }
  g.fillText(value, W / 2, H / 2 + size * 0.03);

  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 4;

  numerals.set(value, tex);
  order.push(value);
  if (order.length > 96) {
    const dead = order.shift()!;
    numerals.get(dead)?.dispose();
    numerals.delete(dead);
  }
  return tex;
}

let glow: CanvasTexture | null = null;
/** Soft radial falloff for additive sparks and accent bleed. */
export function glowTexture(): Texture {
  if (glow) return glow;
  const n = 128;
  const cv = document.createElement("canvas");
  cv.width = n;
  cv.height = n;
  const g = cv.getContext("2d")!;
  const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.28, "rgba(255,255,255,0.55)");
  grad.addColorStop(0.62, "rgba(255,255,255,0.12)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, n, n);
  glow = new CanvasTexture(cv);
  glow.colorSpace = SRGBColorSpace;
  glow.generateMipmaps = false;
  glow.minFilter = LinearFilter;
  return glow;
}

let chip: CanvasTexture | null = null;
/** A hard-edged shard for dust and debris — reads as broken stone, not smoke. */
export function chipTexture(): Texture {
  if (chip) return chip;
  const n = 64;
  const cv = document.createElement("canvas");
  cv.width = n;
  cv.height = n;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, n, n);
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(n * 0.5, n * 0.08);
  g.lineTo(n * 0.9, n * 0.42);
  g.lineTo(n * 0.72, n * 0.92);
  g.lineTo(n * 0.24, n * 0.86);
  g.lineTo(n * 0.08, n * 0.38);
  g.closePath();
  g.fill();
  chip = new CanvasTexture(cv);
  chip.colorSpace = SRGBColorSpace;
  chip.generateMipmaps = false;
  chip.minFilter = LinearFilter;
  return chip;
}

export function disposeTextures(): void {
  for (const t of numerals.values()) t.dispose();
  numerals.clear();
  order.length = 0;
  glow?.dispose();
  glow = null;
  chip?.dispose();
  chip = null;
}
