import { LaneIndex } from "../types";

/**
 * Shared neon palette for the VFX layer. Mirrors Renderer.getNeonColor so
 * particles, rings, and trails read as the same instrument as the note that
 * spawned them. RGB triples are pre-split so we can build rgba() strings with
 * arbitrary alpha cheaply (no per-frame string parsing).
 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const LANE_RGB: Record<number, Rgb> = {
  0: { r: 0, g: 255, b: 255 }, // Cyan
  1: { r: 255, g: 0, b: 255 }, // Pink/Magenta
  2: { r: 0, g: 255, b: 0 }, // Green
};

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const GOLD: Rgb = { r: 255, g: 215, b: 90 };
const RED: Rgb = { r: 255, g: 70, b: 70 };

export function laneRgb(lane: LaneIndex | number): Rgb {
  return LANE_RGB[lane] ?? WHITE;
}

export function laneHex(lane: LaneIndex | number): string {
  const c = laneRgb(lane);
  return rgbToHex(c);
}

export function rgbToHex(c: Rgb): string {
  return `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`;
}

export function rgba(c: Rgb, a: number): string {
  return `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${clamp01(a)})`;
}

/** Linear blend between two colors (t in 0..1). */
export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = clamp01(t);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
  };
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export const COLORS = { WHITE, GOLD, RED };
