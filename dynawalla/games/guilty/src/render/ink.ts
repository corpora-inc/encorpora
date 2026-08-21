// WHAT THE NUMERAL IN A CRYSTAL LANDS ON.
//
// The founder played GUILTY after firing became deliberate and reported that the
// *"numbers could be a bit more legible perhaps (in the crystals)."* This file is
// that, and it is deliberately the same shape as `games/balance/src/ink.ts`,
// because this is the fourth game in the fleet to arrive at the same wall from a
// different direction and the answer is known.
//
// ## The wall
//
// A husk's numeral is one baked sprite, `bake.ts::getGlyph`, and it was three
// passes of ONE COLOUR: a wide blurred halo at alpha 0.34, a tight blurred edge
// at 0.8, and a core that is the same colour mixed 62% toward white. So the
// glyph is a pale cyan letterform standing in a cyan cloud of its own making.
// Measured against that cloud the letterform is **1.65:1 at rest**, and **1.04:1
// in the frames just after the shell is struck**, when the white hit-flash glow
// is added underneath it. The digit does not go dim; it dissolves into its own
// light.
//
// COUNTERPOISE hit this with a specular gradient stop, POLARITY hit it with an
// additive blend mode, and this game hits it with a bloom the glyph itself
// paints. The measurement is the same one in all three cases: the composite,
// including the glow and every overlay, not the colour constant.
//
// ## Recolouring alone cannot fix it, and that is arithmetic
//
// `bestSingleInk` scans the whole grey ramp against every surface a husk numeral
// can land on — the water, the membrane, the deep tint, the husk glow, the white
// hit-flash, and the glyph's own bloom. The ceiling for a single opaque ink is
// **1.87:1 on a resting candidate, and 1.14:1 once the struck states are counted
// too** — and they have to be counted, because a numeral's colour is chosen once
// and then has to survive whatever the shell does next. There is no colour to
// move the numeral to. A lone `fillText` on a bloom it painted itself is
// unfixable by choosing a better colour, and `legibility.test.ts` asserts that
// so nobody rediscovers the dead end by hand.
//
// So the numeral is drawn as a **pair**: the bright core it already had, and an
// opaque counter-ink **rim** stroked between the core and the bloom. The
// guarantee has two layers:
//
//   1. **Letterform.** The digit is resolved against the rim that encircles it,
//      not against the bloom — the rim is opaque and rings the glyph, so it IS
//      the ground for the shape of the digit. `MIN_LETTERFORM = 4.5:1`, WCAG AA
//      for body text, held at the body-text number rather than the 3:1
//      large-text allowance because the reader is a child and the brief was that
//      what shipped was not enough.
//   2. **Object.** The inked blob as a whole must separate from whatever it is
//      lying on. `MIN_OBJECT = 3.0:1`, WCAG 1.4.11 non-text contrast, and one of
//      the core or the rim must clear it on every surface. That second bar is
//      3.0 and not 4.5 for the reason `balance/src/ink.ts` sets out: 4.5 against
//      an *arbitrary* ground is impossible for any two-colour scheme, so
//      claiming it would be a claim no implementation could keep.
//
// ## Why an opaque rim actually darkens anything here
//
// POLARITY's numerals already had a dark contrast rim and it **never darkened a
// pixel**, because they were drawn with `AdditiveBlending` and `vec3(0.0)` adds
// nothing. So the blend mode is checked first here and it is checked in code
// rather than in a comment: `drawGlyph` sets the composite operation for the
// blit itself and defaults it to `source-over`. The one caller that wants the
// sprite added — the chromatic split on a landing equation — asks for `lighter`
// explicitly, and those two ghost blits are decoration at alpha 0.32 that no
// child reads.

import { C } from "../core/palette.ts";

export type RGB = readonly [number, number, number];

/** The digit against the rim that encircles it. WCAG AA body text. */
export const MIN_LETTERFORM = 4.5;

/** The inked blob against the ground it lies on. WCAG 1.4.11 non-text contrast. */
export const MIN_OBJECT = 3.0;

export function rgb(hex: string): RGB {
  const s = hex.replace("#", "");
  const n = Number.parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, 0..1 — the sRGB transfer curve, as WCAG defines it. */
export function luma(c: RGB): number {
  const f = (v: number): number => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

/** WCAG contrast ratio between two opaque colours, 1..21. */
export function contrast(a: RGB, b: RGB): number {
  const la = luma(a);
  const lb = luma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `globalCompositeOperation = "source-over"` at `alpha`. */
export function over(src: RGB, dst: RGB, alpha: number): RGB {
  const m = (i: 0 | 1 | 2): number => Math.round(src[i] * alpha + dst[i] * (1 - alpha));
  return [m(0), m(1), m(2)];
}

/** `globalCompositeOperation = "lighter"` at `alpha` — additive, clamped. */
export function plus(src: RGB, dst: RGB, alpha: number): RGB {
  const m = (i: 0 | 1 | 2): number => Math.min(255, Math.round(src[i] * alpha + dst[i]));
  return [m(0), m(1), m(2)];
}

// ------------------------------------------------------------------- the inks

/**
 * How far toward white a glyph's core is pushed, and how wide the rim is.
 *
 * `bake.ts` reads both of these rather than holding literals of its own, so the
 * sprite the canvas paints and the colours this file measures cannot drift
 * apart. That was the failure mode worth designing against: a palette copied
 * into a test goes stale the moment somebody warms up the ink.
 */
export const CORE_MIX = 0.62;

/**
 * Padding the bake leaves round a glyph, as a fraction of the em.
 *
 * It exists for the blurred halo, and the rim has to fit inside it too — a rim
 * that reached past the sprite's edge would clip its own contour and the digit
 * would read as a broken outline. `legibility.test.ts` asserts that against THIS
 * constant rather than against a literal copied out of `bake.ts`.
 */
export const GLYPH_PAD = 0.62;

/**
 * Rim width as a fraction of the bake em, stroked centred on the letterform —
 * so half of it lies under the core fill and half of it shows.
 *
 * **The ring is narrower than the wireframe edge that crosses it, and that is
 * stated here rather than wished away.** The visible reach is `0.0575 × size`,
 * and a three-digit label draws at about `0.89 × r × scale` — so on the two
 * extremes this game runs at, 320×568 portrait (`scale = 2.18`) and 844×390
 * landscape (`scale = 1.50`), the ring reaches 1.50px and 1.03px while a husk
 * edge is `EDGE_WIDTH × scale` = 3.28px and 2.25px, and up to 2.6× that in the
 * frames after a strike. An earlier version of `legibility.test.ts` asserted the
 * opposite by measuring the ring at its widest (a one-digit label at the size
 * cap) against an edge at a scale the game never reaches.
 *
 * What makes the pair hold anyway is that the ring is a **closed contour** and
 * the edge is a straight stroke laid over it *additively*. A crossing brightens
 * a short arc of the ring and the core beneath it by the same amount — it
 * cannot darken the core, cannot invert the pair, and cannot reach the rest of
 * the contour, which is what the letterform is resolved against. And the widest
 * crossings, at full `hitFlash`, live in the ~0.18s after a strike has already
 * landed: a frame in which the child has answered, not one in which they are
 * reading.
 *
 * 0.115 em is then the widest ring that still leaves a three-digit label's
 * counters open at the size a phone draws it.
 */
export const RIM_WIDTH = 0.115;

/**
 * The husk wireframe, as `drawHusk` strokes it: `EDGE_WIDTH × scale`, times up
 * to `1 + EDGE_FLASH_GAIN` in the frames after a strike, floored at 0.9px.
 *
 * Here rather than in `husk.ts` because the claim above is a claim about the
 * relationship between this and `RIM_WIDTH`, and a claim about a copy of a
 * constant is not a claim about anything.
 */
export const EDGE_WIDTH = 1.5;
export const EDGE_FLASH_GAIN = 1.6;

/** How far the rim reaches beyond the letterform, in screen pixels, at `size`. */
export function rimReachPx(size: number): number {
  return (size * RIM_WIDTH) / 2;
}

/** The width of a husk's wireframe edge, in screen pixels. */
export function edgeWidthPx(scale: number, flash: number): number {
  return Math.max(0.9, EDGE_WIDTH * scale * (1 + flash * EDGE_FLASH_GAIN));
}

/**
 * The counter-ink: the trench's own darkest water.
 *
 * Not `#000000`. The trench is lamplit black-green and a pure-black contour on a
 * bioluminescent glyph reads as a sticker laid over the scene rather than as a
 * shadow inside it. `#02060d` is literally `WATER[0]`, the top stop of the
 * background gradient, and it measures 17.93:1 against the cyan core, 12.27:1
 * against the hostile core and 17.14:1 against the amber core — every one of
 * them two and a half times `MIN_LETTERFORM` or better.
 */
export const INK_RIM = "#02060d";

/** The core a glyph of `color` is filled with, after `CORE_MIX` toward white. */
export function core(color: string): RGB {
  const c = rgb(color);
  const w = 255;
  const m = (i: 0 | 1 | 2): number => Math.round(c[i] + (w - c[i]) * CORE_MIX);
  return [m(0), m(1), m(2)];
}

// ------------------------------------------------------- the surfaces themselves

/**
 * The trench gradient, as stops.
 *
 * `scene.ts` builds its background from this array rather than from five
 * literals of its own, for the same reason `draw.ts` reads BRASS_BODY out of
 * COUNTERPOISE's ink file: the numeral's contrast is a claim about the water,
 * and a claim about a copy of the water is not a claim about anything.
 */
export const WATER: readonly string[] = ["#02060d", "#02070e", "#030c15", "#05161f", "#020a11"];

/**
 * The cold sheen from the surface, painted over the gradient at 0.17, and the
 * light shafts, additive at up to `0.1 × 0.58` where they cross a husk.
 *
 * Taken from `palette.ts` rather than restated. Every colour this file measures
 * has to be the colour the canvas paints or the table below is a table about
 * nothing — that is precisely how COUNTERPOISE shipped a numeral at 1.08:1 while
 * a test file full of colour literals said it was fine.
 */
export const SHEEN = C.surface;
export const SHAFT = C.plankton;

/** The membrane inside a husk: an opaque-ish dark skin over the equator quad. */
export const MEMBRANE = "#030a11";

/** Every colour the water itself presents behind a husk. */
export function waterSurfaces(): RGB[] {
  const out: RGB[] = [];
  for (const stop of WATER) {
    const b = rgb(stop);
    out.push(b);
    out.push(over(rgb(SHEEN), b, 0.17));
    out.push(plus(rgb(SHAFT), b, 0.058));
  }
  return out;
}

/**
 * A crystal, as the two flags and the two dials `drawHusk` actually switches on.
 *
 * Not a state *name*: `drawHusk` keys the membrane tint on `world.quality`, the
 * glow on `hitFlash`, and the colour on `hostile`, and those are independent. A
 * three-state enum would collapse combinations that are all reachable — a
 * struck shell on a thermally-throttled phone is a different ground from a
 * struck shell on a cold one, and it is the darker of the two.
 */
export type CrystalState = {
  /** A husk the player already shot by mistake: red, spiky, diving. */
  hostile?: boolean;
  /** `Husk.hitFlash`, 0..1 — decays at 5.5/s after a strike lands. */
  flash?: number;
  /** `World.quality`, 0.45..1. At or below 0.7 the deep membrane tint is skipped. */
  quality?: number;
  /** The shell is still shut: the label is scrambled and drawn at alpha 0.32. */
  shut?: boolean;
};

/** The accent a crystal in this state is drawn in — `drawHusk`'s own choice. */
export function crystalColor(s: CrystalState): string {
  return s.hostile ? C.hostile : C.cyan;
}

/**
 * The ground a crystal's numeral is read against, built the way `drawHusk`
 * builds it: water, then membrane, then the deep tint (only above quality 0.7),
 * then the husk glow, then the white hit-flash glow.
 *
 * The wireframe edges are deliberately absent from this list and that is a
 * checked absence, not an assumed one: `game.ts` flushes the line batch AFTER
 * every husk has blitted its glyph, additively. Those twelve edges therefore
 * land ON the numeral rather than under it. They are 1.5px at scale against a
 * rim of ~2.4px, so they cross the ring rather than replacing it —
 * `legibility.test.ts` measures that crossing separately instead of pretending
 * it is ground.
 */
export function crystalGround(s: CrystalState): RGB[] {
  const flash = s.flash ?? 0;
  const quality = s.quality ?? 1;
  const accent = rgb(crystalColor(s));
  const deep = rgb(s.hostile ? C.hostileDeep : C.cyanDeep);
  const white = rgb(C.white);
  const out: RGB[] = [];
  for (const w of waterSurfaces()) {
    let g = over(rgb(MEMBRANE), w, 0.72);
    if (quality > 0.7) g = over(deep, g, 0.34 + flash * 0.4);
    g = plus(accent, g, 0.1 + flash * 0.45);
    if (flash > 0.02) g = plus(white, g, flash * 0.45);
    out.push(g);
  }
  return out;
}

/**
 * The glyph's own bloom, hugging the letterform — the ground the OLD numeral was
 * actually read against, and the reason it could not be read.
 *
 * Three alphas because the bake lays down three passes and the blur ramps
 * between them: 0.8 immediately outside the letterform, falling through 0.55 to
 * 0.34 a little further out. All three are inside the ring the rim now occupies
 * or just beyond it, so all three are what the digit competed with.
 */
export function crystalBloom(s: CrystalState): RGB[] {
  const c = rgb(crystalColor(s));
  const out: RGB[] = [];
  for (const g of crystalGround(s)) {
    for (const a of [0.8, 0.55, 0.34]) out.push(over(c, g, a));
  }
  return out;
}

/** Every surface a crystal's numeral can land on: the ground, and the bloom over it. */
export function crystalSurfaces(s: CrystalState): RGB[] {
  return [...crystalGround(s), ...crystalBloom(s)];
}

/**
 * The ground under the accusation at the top of the trench.
 *
 * The equation is the same baked sprite in amber, blitted over the raw water
 * with one soft amber glow behind it, so it had the same defect for the same
 * reason and it is fixed by the same rim.
 */
export function equationGround(): RGB[] {
  const amber = rgb(C.amber);
  return waterSurfaces().map((w) => plus(amber, w, 0.19));
}

export function equationBloom(): RGB[] {
  const amber = rgb(C.amber);
  const out: RGB[] = [];
  for (const g of equationGround()) for (const a of [0.8, 0.55, 0.34]) out.push(over(amber, g, a));
  return out;
}

// ------------------------------------------------------------------ the maths

/**
 * The worst letterform contrast this core presents against `surfaces`.
 *
 * The minimum, not the average: a digit is illegible in the frame where it is
 * worst, and the frame where it is worst is the frame a child is looking at it.
 */
export function worstAgainst(ink: RGB, surfaces: readonly RGB[]): number {
  let worst = Infinity;
  for (const s of surfaces) worst = Math.min(worst, contrast(ink, s));
  return worst;
}

/**
 * The worst object-contrast a core/rim pair presents over `surfaces`.
 *
 * Per surface, the better of the two edges — an inked blob separates from its
 * ground if *either* the digit or the ring around it does. The minimum over
 * every surface is the number `MIN_OBJECT` is asserted against.
 */
export function worstEdge(ink: RGB, rim: RGB, surfaces: readonly RGB[]): number {
  let worst = Infinity;
  for (const s of surfaces) worst = Math.min(worst, Math.max(contrast(ink, s), contrast(rim, s)));
  return worst;
}

/**
 * The best contrast ANY single opaque ink could reach against all of
 * `surfaces` — the ceiling the shipped three-pass sprite was working under.
 *
 * Contrast depends on an ink only through its luminance, so scanning the 256
 * greys bounds every colour: no hue can beat the grey of the same luminance.
 */
export function bestSingleInk(surfaces: readonly RGB[]): number {
  let best = 0;
  for (let v = 0; v <= 255; v++) {
    const ink: RGB = [v, v, v];
    best = Math.max(best, worstAgainst(ink, surfaces));
  }
  return best;
}
