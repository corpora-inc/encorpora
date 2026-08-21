// WHAT THE NUMERAL LANDS ON.
//
// The founder played COUNTERPOISE and reported two things about the numbers
// engraved on the weights: *"they are a bit small and not enough contrast for
// me."* Size is `layout.ts`. This file is contrast, and it is here because the
// old answer to contrast was a hard-coded `#ffeec4` — one colour, chosen once,
// against a brass disc whose own gradient runs from `#201604` to `#f7e6b4`.
//
// `#ffeec4` on `#f7e6b4` measures **1.08:1**. That is not "a bit low"; that is
// the numeral and the specular streak of the brass being the same colour, and
// the streak sits at gradient stop 0.34 — a third of the way across the disc,
// which is exactly where a two-digit numeral is drawn. VOLTA had the same class
// of bug and it was found the same way: by measuring every surface instead of
// spot-checking the one the author happened to be looking at.
//
// ## Recolouring alone cannot fix this, and that is arithmetic
//
// For an ink to clear 4.5:1 against `#f7e6b4` (relative luminance 0.797) it
// needs luminance <= 0.138. To clear 4.5:1 against `#201604` (luminance 0.0089)
// it needs luminance >= 0.215. No colour satisfies both. `bestSingleInk` scans
// the whole grey ramp and reports the real ceiling for each object in this pack:
// **1.30:1 on a weight, 1.92:1 on a balloon, 1.90:1 in a crate.** A lone
// `fillText` on these surfaces is unfixable by choosing a better colour, and
// `legibility.test.ts` asserts that so nobody rediscovers the dead end by hand.
//
// So a numeral is drawn as a **pair**: an ink, and an opaque counter-ink halo
// stroked behind it. Both are derived from the surfaces of the object being
// drawn. The guarantee has two layers, because the reader's eye has two jobs:
//
//   1. **Letterform.** The glyph is resolved against the halo that rings it, not
//      against the brass — the halo is opaque and encircles the glyph, so it IS
//      the ground for the shape of the digit. `MIN_LETTERFORM = 4.5:1`, WCAG AA
//      for body text. Held at the body-text number rather than the 3:1 large-text
//      allowance because the reader is a child and the brief was that what
//      shipped was not enough.
//   2. **Object.** The inked blob as a whole must be visible against whatever it
//      is lying on. `MIN_OBJECT = 3.0:1`, WCAG 1.4.11 non-text contrast, and one
//      of the ink or the halo must clear it on every surface.
//
// The second bar is 3.0 and not 4.5 for a reason worth stating: **4.5 against an
// arbitrary ground is impossible for any two-colour scheme.** An ink and a halo
// at opposite poles leave a crossover band of ground luminance where neither
// clears 4.5; solving (1.05)/(L+0.05) = (L+0.05)/(0.05) puts the crossover at
// L = 0.179 and the best achievable there at **4.58:1 — and that is with pure
// `#000` on pure `#fff`.** Any real palette does worse. Claiming 4.5:1 against
// every raw surface would therefore be a claim no implementation could keep.
// What is claimed instead is measured, and it holds: see the table in the test.

export type RGB = readonly [number, number, number];

/** Ink against the halo that rings it. WCAG AA body text. */
export const MIN_LETTERFORM = 4.5;

/** The inked blob against the ground it lies on. WCAG 1.4.11 non-text contrast. */
export const MIN_OBJECT = 3.0;

export function rgb(hex: string): RGB {
  const s = hex.replace("#", "");
  const n = Number.parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Relative luminance, 0..1 — the same sRGB transfer curve `luma` uses in STACK's
 * `strata.ts`, where the HUD picks light-on-dark or dark-on-light from the sky
 * it actually sits in front of. Same idea, same maths, a different surface.
 */
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

// ------------------------------------------------------------------- the poles

/**
 * The two colours an ink or a halo is ever drawn in.
 *
 * Warm rather than pure black and white: the observatory is lamplit brass, and a
 * `#ffffff` glyph on it reads as a browser rather than as an instrument. Both are
 * pushed far enough into their corners to leave the letterform bar room —
 * `INK_LIGHT` is luminance 0.927, `INK_DARK` is 0.0026, and between them they
 * measure 18.56:1, four times the bar.
 */
export const INK_LIGHT = "#fff6e2";
export const INK_DARK = "#0d0801";

/**
 * Which pole an ink should be, for an object whose dominant ground is `ground`.
 *
 * Counted, not chosen: whichever pole clears the letterform bar against more of
 * the ground wins, ties going to light. `ground` is deliberately the object's own
 * gradient and not the exhaustive surface catalogue — a thin collar arc and a
 * knurl mark are ground under a few percent of the glyph and would otherwise get
 * an equal vote with the body of the brass and swing the answer.
 *
 * On brass this returns "light" (six of the ten body and top-face stops are dark
 * enough for a pale glyph, four are not). On the copper balloon it returns
 * "dark", which is what the art already did by hand. The point is not that every
 * answer changes; it is that no answer is asserted by hand any more.
 */
export function inkPole(ground: readonly RGB[]): "light" | "dark" {
  const light = rgb(INK_LIGHT);
  const dark = rgb(INK_DARK);
  let nl = 0;
  let nd = 0;
  for (const s of ground) {
    if (contrast(light, s) >= MIN_LETTERFORM) nl++;
    if (contrast(dark, s) >= MIN_LETTERFORM) nd++;
  }
  return nl >= nd ? "light" : "dark";
}

/** The ink for an object with this dominant ground, when no colour carries meaning. */
export function inkFor(ground: readonly RGB[]): string {
  return inkPole(ground) === "light" ? INK_LIGHT : INK_DARK;
}

/**
 * The halo for an ink: the opposite pole.
 *
 * Not a free choice — a mid-grey halo would satisfy "opposite" while failing the
 * letterform bar. Splitting on 0.18 puts every ink this pack uses (`#ffd07a` at
 * 0.678, `#5fae95` at 0.349, `#cfe3ea` at 0.741, `INK_LIGHT` at 0.927,
 * `INK_DARK` at 0.003) on the side that clears the other pole.
 */
export function haloFor(ink: string): string {
  return luma(rgb(ink)) > 0.18 ? INK_DARK : INK_LIGHT;
}

/**
 * The worst object-contrast this ink/halo pair presents over `surfaces`.
 *
 * Per surface, the better of the two edges — the ink's own contrast, or the
 * halo's — because an inked blob is visible if *either* the glyph or the ring
 * around it separates from the ground. The minimum over every surface is the
 * number `MIN_OBJECT` is asserted against.
 */
export function worstEdge(ink: string, halo: string, surfaces: readonly RGB[]): number {
  const i = rgb(ink);
  const h = rgb(halo);
  let worst = Infinity;
  for (const s of surfaces) worst = Math.min(worst, Math.max(contrast(i, s), contrast(h, s)));
  return worst;
}

/**
 * The best contrast ANY single opaque ink could achieve against all of
 * `surfaces` — the ceiling the shipped `fillText` was working under.
 *
 * Contrast depends on the ink only through its luminance, so scanning the 256
 * greys bounds every colour: no hue can beat the grey of the same luminance.
 */
export function bestSingleInk(surfaces: readonly RGB[]): number {
  let best = 0;
  for (let v = 0; v <= 255; v++) {
    const ink: RGB = [v, v, v];
    let worst = Infinity;
    for (const s of surfaces) worst = Math.min(worst, contrast(ink, s));
    best = Math.max(best, worst);
  }
  return best;
}

// ------------------------------------------------------- the surfaces themselves

/**
 * The brass body of a weight, as gradient stops.
 *
 * `draw.ts` builds its `wbody` gradient from this array rather than from six
 * literals of its own, so the catalogue the legibility test measures and the
 * gradient the canvas paints cannot drift apart. That was the failure mode worth
 * designing against: a colour list living in a test file is a snapshot, and a
 * snapshot goes stale the first time somebody warms up the brass.
 */
/**
 * The brass itself, and the copper of a balloon.
 *
 * These live here and `draw.ts` reads them into its `C` palette, rather than the
 * other way round, because the numeral's contrast is a claim about them. When
 * they were literals in two places the disc could be warmed up without the
 * column it stands on following, and — worse — without a single number in the
 * legibility table changing.
 */
export const BRASS_LO = "#6a4f1d";
export const BRASS_MID = "#b08a3c";
export const BRASS_HI = "#f7e6b4";
export const COPPER = "#c8763f";

export const BRASS_BODY: ReadonlyArray<readonly [number, string]> = [
  [0, "#2b1e07"],
  [0.14, BRASS_LO],
  [0.34, BRASS_HI],
  [0.52, BRASS_MID],
  [0.8, "#7a5a1e"],
  [1, "#201604"],
];

/** The machined top face of a weight. A tall single digit reaches up into it. */
export const BRASS_TOP: ReadonlyArray<readonly [number, string]> = [
  [0, "#8a6a26"],
  [0.4, "#e9d197"],
  [0.62, BRASS_HI],
  [1, "#7c5d1f"],
];

/** The foil balloon a "how many of these" board floats. */
export const BALLOON_BODY: ReadonlyArray<readonly [number, string]> = [
  [0, "#ffe6c8"],
  [0.28, "#e79a5c"],
  [0.72, COPPER],
  [1, "#612f12"],
];

const stops = (g: ReadonlyArray<readonly [number, string]>): RGB[] => g.map(([, c]) => rgb(c));

/** The dominant ground under a numeral on a weight: the brass itself. */
export function weightGround(): RGB[] {
  return [...stops(BRASS_BODY), ...stops(BRASS_TOP)];
}

/**
 * EVERY surface a numeral on a weight can land on.
 *
 * The brass, plus the two overlays drawn between the body and the numeral, which
 * therefore change the ground under it:
 *
 *   - the knurl marks, `rgba(50,34,8,0.28)`, whose band the numeral's ascenders
 *     reach into;
 *   - the bright collar a player-placed weight wears, `rgba(255,240,206,0.5)`,
 *     which crosses the numeral's descender band on every weight the child put
 *     there — that is, on most of them, for most of the turn;
 *   - the two rings around the machined top face, `rgba(255,244,214,0.6)` and
 *     `rgba(60,42,10,0.4)`. The lower arc of that ellipse crosses `y = -0.17r`
 *     at the disc's centre line, and a solo digit reaches `y ≈ -0.34r` before
 *     its halo, so it is genuinely underneath the glyph rather than above it.
 *
 * The drag and hover glow is deliberately absent, and that is a checked absence
 * rather than an assumed one: it is painted *before* the body and the body is
 * opaque, so it never reaches the numeral's ground.
 */
export function weightSurfaces(): RGB[] {
  const base = weightGround();
  const knurl = rgb("#322208");
  const collar = rgb("#fff0ce");
  const faceRim = rgb("#fff4d6");
  const innerRing = rgb("#3c2a0a");
  return [
    ...base,
    ...base.map((s) => over(knurl, s, 0.28)),
    ...base.map((s) => over(collar, s, 0.5)),
    ...base.map((s) => over(faceRim, s, 0.6)),
    ...base.map((s) => over(innerRing, s, 0.4)),
  ];
}

/** The dominant ground under a numeral on a balloon. */
export function balloonGround(): RGB[] {
  return stops(BALLOON_BODY);
}

/** Every surface on a balloon: the body, plus the additive foil highlight whose
 * ellipse overlaps the numeral's upper half. */
export function balloonSurfaces(): RGB[] {
  const base = balloonGround();
  const foil = rgb("#fff0dc");
  return [...base, ...base.map((s) => plus(foil, s, 0.25))];
}

/**
 * What a crate window is showing — **four states, not three.**
 *
 * `Renderer.crate` switches on two independent flags and they do not line up:
 * the window's base colour is keyed on `v.declared` alone, while the mist is
 * keyed on `!v.declared || v.wrong > 0` and the ink on `v.wrong > 0` first. A
 * three-state model collapses the fourth combination — **rejected, with the
 * value already cleared** — onto the wrong base, and it is reachable: a child
 * who presses Backspace inside the ~0.6s rejection window leaves `wrong > 0`
 * with `declared === null`, so the cold label is read over mist on `#0f1a20`
 * rather than mist on `#2c2412`. That is the darkest ground any crate label
 * lands on, and modelling it as the lighter one hid a genuine 2.82:1.
 */
export type CrateState = "unknown" | "declared" | "rejected" | "rejectedEmpty";

/** The mist drifting in an unresolved crate window: four ellipses, stacked. */
function mistOver(base: RGB): RGB[] {
  const mist = rgb("#78aabe");
  const out: RGB[] = [base];
  let c = base;
  for (let i = 0; i < 4; i++) {
    c = over(mist, c, 0.1 + i * 0.03);
    out.push(c);
  }
  return out;
}

/**
 * The dominant ground under a crate's label: the window it is read through.
 *
 * Built the way `Renderer.crate` builds it — base from `declared`, mist or
 * win-glow from `!declared || wrong` — rather than from a state name, so the two
 * cannot drift into disagreeing about which of the four combinations is which.
 */
export function crateGround(state: CrateState): RGB[] {
  const declared = state === "declared" || state === "rejected";
  const base = rgb(declared ? "#2c2412" : "#0f1a20");
  if (declared && state === "declared") {
    // the warm win-glow, additive, brightest dead centre — where the numeral is
    return [base, plus(rgb("#ffd68c"), base, 0.5)];
  }
  return mistOver(base);
}

/**
 * Every surface a crate's label can land on.
 *
 * The label is laid out from `wr * 1.45` where `wr` is the window radius, so it
 * is deliberately wider than the window: it crosses the glass rim and runs out
 * onto the iron shell, the brass banding and the rivets. It also passes under
 * the specular arc struck across the glass — `rgba(255,255,255,0.25)` in
 * `lighter`, at `0.82wr` — which is additive and therefore the brightest thing
 * inside the window. All of that is ground under the numeral, so all of it is
 * here.
 */
export function crateSurfaces(state: CrateState): RGB[] {
  const iron = [rgb("#2b333d"), rgb("#161b22"), rgb("#0d1116")];
  const band = iron.map((s) => over(rgb("#c69e54"), s, 0.75));
  const rivet = [rgb("#d8b877")];
  const window = crateGround(state);
  const specular = window.map((s) => plus(rgb("#ffffff"), s, 0.25));
  const rim = [...window, ...iron].map((s) => over(rgb("#d6b268"), s, 0.9));
  return [...window, ...specular, ...iron, ...band, ...rivet, ...rim];
}
