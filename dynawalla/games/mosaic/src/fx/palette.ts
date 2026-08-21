/**
 * Art direction: a backlit stained-glass window in a dark cathedral.
 *
 * The register was chosen because it does one thing no other look can — it
 * makes "fraction of the wall cleared" a *physical* quantity. Light lives
 * behind the glass. Every tile you break is a hole the light comes through, so
 * 7/12 cleared is not a number in a corner, it is how bright the room is. The
 * last tile blows the window out entirely.
 *
 * Tiles are luminous and the numerals are dark leading, which is both how real
 * stained glass reads and the highest-contrast way to put a number on colour.
 * Colour never encodes guilt — the only way to know which tiles break is to do
 * the arithmetic, and colour-blind players lose nothing.
 */

export type Jewel = {
  /** Core glass colour, luminous. */
  glass: string;
  /** Bevel highlight along the top-left. */
  hi: string;
  /** Shadowed inner edge. */
  lo: string;
  /** Additive glow used for breaks, sparks and the halo. */
  glow: string;
  /** Shard fill when it shatters. */
  shard: string;
};

export const JEWELS: Jewel[] = [
  { glass: "#ff5f7d", hi: "#ffd0d8", lo: "#a01f3f", glow: "#ff8fa4", shard: "#ff7d95" },
  { glass: "#ffab3f", hi: "#ffe9c0", lo: "#a35a0d", glow: "#ffc978", shard: "#ffbe66" },
  { glass: "#3ce7a8", hi: "#ccfff0", lo: "#0f7d58", glow: "#7dffcd", shard: "#63eeb8" },
  { glass: "#5fa0ff", hi: "#d5e6ff", lo: "#1f47a8", glow: "#9cc3ff", shard: "#82b2ff" },
  { glass: "#c47cff", hi: "#eed7ff", lo: "#6a2ea0", glow: "#dcaaff", shard: "#d195ff" },
  { glass: "#ffe25c", hi: "#fffbd6", lo: "#9c8210", glow: "#fff09a", shard: "#ffea7d" },
];

export const INK = "#150d22";
export const INK_SOFT = "rgba(21,13,34,0.62)";

export const BG_TOP = "#0b0a1c";
export const BG_BOTTOM = "#040310";
export const STONE = "#171531";
export const STONE_HI = "#262347";

export const LIGHT_WARM = "#ffd9a0";
export const LIGHT_HOT = "#fff4de";

export const BALL_CORE = "#fffdf5";
export const BALL_GLOW = "#ffd98a";

export const CHARGE_COLD = "#4c6bb5";
export const CHARGE_HOT = "#ffe08a";

export const DANGER = "#ff5d73";

/** Power identity — icon glyph plus its light. Never text, never a mascot. */
export const POWER_LOOK: Record<string, { glow: string; ink: string }> = {
  multi: { glow: "#6cf0bd", ink: "#04150f" },
  laser: { glow: "#ff7d92", ink: "#1c0409" },
  wide: { glow: "#8db3ff", ink: "#040c1e" },
  slow: { glow: "#cf9bff", ink: "#100420" },
};
