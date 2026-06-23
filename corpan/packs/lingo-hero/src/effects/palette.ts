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

// Elevated "Neon Arcade" lane colors — single-sourced to the --na-lane-* design
// tokens (cyan #2ff3ff / magenta #ff00d4 / lime #7bff7b) so particles, rings,
// trails, and the Renderer's lanes/cards all read as ONE coherent instrument.
// (The harsh pure #00ffff / #00ff00 of the bootstrap palette muddied the bloom.)
const LANE_RGB: Record<number, Rgb> = {
  0: { r: 47, g: 243, b: 255 }, // Cyan   — --na-lane-1
  1: { r: 255, g: 0, b: 212 }, // Magenta — --na-lane-2
  2: { r: 123, g: 255, b: 123 }, // Lime  — --na-lane-3
};

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const GOLD: Rgb = { r: 255, g: 211, b: 92 }; // warm arcade gold (combo / milestones)
const RED: Rgb = { r: 255, g: 62, b: 120 }; // --na-wrong-adjacent neon pink-red
const PINK: Rgb = { r: 255, g: 62, b: 165 }; // --neon-pink, for miss washes

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

export const COLORS = { WHITE, GOLD, RED, PINK };
