/**
 * WHAT A NUMERAL LANDS ON, AND WHAT COLOUR IT THEREFORE HAS TO BE.
 *
 * The founder played POLARITY and reported: *"polarity needs contrast in some
 * parts like i cant see the answers."* The screenshot shows three answer orbs
 * bunched together in the hot palette; two are readable and pale, and the third
 * has no numeral on it at all that a person can see.
 *
 * The third orb is not a colour-list problem, and the difference matters,
 * because recolouring cannot fix it. **The numerals were drawn with
 * `AdditiveBlending`** (`renderer.ts` defaulted the label layer to it, like
 * every other layer in this vector-monitor pack). Two things follow, and both
 * are arithmetic rather than taste:
 *
 *   1. **The baked contrast rim was a no-op.** `atlas.ts` strokes a dark ring
 *      around every glyph and `LABEL_FRAG` resolves that ring to `vec3(0.0)`.
 *      Under `src * srcAlpha + dst`, black adds nothing. The rim the pack
 *      believed it had never darkened a single pixel. It cost texture, it cost
 *      a stroke per tile, and it did nothing at all.
 *   2. **An additive glyph cannot exceed 1.00:1 on a saturated ground.** Where
 *      the framebuffer is already at 1.0 in a channel, adding ink cannot change
 *      it. An orb's own additive halo is `exp(-...)*0.55` over a body that is
 *      already `POS_A` bright, and orbs OVERLAP — their halos add — so the
 *      centre of a bunch genuinely clips to white. `bestAdditiveInk()` scans
 *      every colour and reports the ceiling: **1.00:1 on an orb.** That is not
 *      "low contrast". That is the third orb, exactly, and no palette change
 *      reaches it.
 *
 * COUNTERPOISE (`games/balance/src/ink.ts`, PR #758) hit the same wall from the
 * other side — an opaque `fillText` on bright brass, ceiling 1.24:1 — and the
 * answer it landed on is the one used here, because it is the only one that
 * works: **a numeral is a pair.** An ink, and an opaque counter-ink halo
 * stroked behind it, both derived from the surfaces of the object being drawn,
 * with two bars:
 *
 *   1. **Letterform**, `MIN_LETTERFORM = 4.5:1`. The glyph is resolved against
 *      the halo that rings it. The halo is opaque and encircles the glyph, so
 *      it IS the ground for the shape of the digit — but only once the layer is
 *      `NormalBlending`, which is the other half of the fix.
 *   2. **Object**, `MIN_OBJECT = 3.0:1`. The inked blob as a whole against
 *      whatever it lies on, with either the ink or the halo allowed to carry
 *      it. 3.0 and not 4.5 for the reason `balance/src/ink.ts` sets out: at the
 *      crossover ground luminance no two-colour scheme clears 4.5, not even
 *      pure black and pure white.
 *
 * ## The bloom is part of the surface, and here it is part of the SCENE
 *
 * POLARITY composites glow in two places. Every tier has the in-shader additive
 * halo, which is what actually blew out the founder's screenshot (that device
 * detects as `mid`, which has no bloom pass at all). The `ultra` tier adds an
 * `UnrealBloomPass` on top. Both are modelled here, both land in the surface
 * catalogue, and the renderer now draws the numerals into an OVERLAY scene
 * composited after the bloom pass rather than into the bloomed scene — so the
 * glow is under the glyph instead of over it. What the glyph is read against is
 * therefore `SURFACES`, which is measured, and not "whatever the post chain did
 * to it afterwards", which is not.
 *
 * ## Why the surfaces are computed and not listed
 *
 * A colour list in a test file is a snapshot, and a snapshot goes stale the
 * first time somebody warms up a palette. So the shader's own numbers live here
 * — `PAL`, `ORB`, `CHG`, `HALO` — and `shaders.ts` interpolates them into the
 * GLSL. The catalogue is then produced by evaluating a port of the fragment
 * function over the exact rectangle the label quad covers. If the orb gets
 * brighter, the table moves.
 */

export type RGB = readonly [number, number, number];

/** Ink against the halo that rings it. WCAG AA body text. */
export const MIN_LETTERFORM = 4.5;

/** The inked blob against the ground it lies on. WCAG 1.4.11 non-text contrast. */
export const MIN_OBJECT = 3.0;

// ------------------------------------------------------------------ the maths

/**
 * Relative luminance, 0..1, of an sRGB triple in 0..1.
 *
 * These shaders write raw values to the framebuffer — no tone map, no transfer
 * — so a shader's `vec3` IS an sRGB triple and this is the curve that applies
 * to it. Same maths as `balance/src/ink.ts` and STACK's `strata.ts`, a
 * different unit only because this pack's palette is floats.
 */
export function luma(c: RGB): number {
  const f = (v: number): number => {
    const x = Math.min(1, Math.max(0, v));
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

/** `AdditiveBlending`: `src * srcAlpha + dst`, clamped by the framebuffer. */
export function add(src: RGB, dst: RGB, alpha = 1): RGB {
  const m = (i: 0 | 1 | 2): number => Math.min(1, src[i] * alpha + dst[i]);
  return [m(0), m(1), m(2)];
}

/** `NormalBlending`: `src * srcAlpha + dst * (1 - srcAlpha)`. */
export function over(src: RGB, dst: RGB, alpha: number): RGB {
  const m = (i: 0 | 1 | 2): number => src[i] * alpha + dst[i] * (1 - alpha);
  return [m(0), m(1), m(2)];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

const WHITE: RGB = [1, 1, 1];

// ------------------------------------------------------------------ the poles

/**
 * The two colours an ink or a halo is ever drawn in.
 *
 * Cool rather than pure black and white: the cabinet clears to `#03040b` and
 * the whole register is a phosphor monitor, so `INK_DARK` is that same deep
 * navy pushed to its floor and `INK_LIGHT` is a slightly blue paper white.
 * Between them they measure 18.4:1, four times the letterform bar, and — the
 * number that matters for `MIN_OBJECT` — their crossover is 4.29:1, so against
 * ANY ground whatsoever one of the two clears 3.0. That is what lets the object
 * bar be a guarantee rather than a hope, and it is why they sit this far into
 * their corners instead of being tastefully softened.
 */
export const INK_LIGHT: RGB = [0.933, 0.957, 1.0];
export const INK_DARK: RGB = [0.016, 0.02, 0.055];

/**
 * Which pole an ink should be, for an object whose ground is `ground`.
 *
 * Counted, not chosen: whichever pole clears the letterform bar against more of
 * the ground wins, ties going to light. The halo is then the other one, so the
 * decision is made once and the pair follows.
 */
export function inkPole(ground: readonly RGB[]): "light" | "dark" {
  let nl = 0;
  let nd = 0;
  for (const s of ground) {
    if (contrast(INK_LIGHT, s) >= MIN_LETTERFORM) nl++;
    if (contrast(INK_DARK, s) >= MIN_LETTERFORM) nd++;
  }
  return nl >= nd ? "light" : "dark";
}

export type InkPair = { ink: RGB; halo: RGB };

/** The ink and the counter-ink halo for a numeral read against `ground`. */
export function inkPairFor(ground: readonly RGB[]): InkPair {
  return inkPole(ground) === "light"
    ? { ink: INK_LIGHT, halo: INK_DARK }
    : { ink: INK_DARK, halo: INK_LIGHT };
}

/**
 * The alpha the halo is stroked at in `atlas.ts`, and the reason the letterform
 * bar is a claim rather than a tautology.
 *
 * At 1 the halo replaces the ground and the glyph is read against the halo,
 * which is 18.4:1 whatever is underneath. Below 1 the halo is a tint of the
 * ground and the two converge — at the 0.92 that shipped it is still fine, at
 * 0.5 it is not — so `letterformEdge` blends both through it and the bar is
 * measured rather than restated.
 */
export const HALO_ALPHA = 1;

/**
 * How long a rising float text holds full opacity before it dissolves.
 *
 * Its instance alpha is `clamp01((1 - age/life) * FLOAT_HOLD) ** 2`, so at 1
 * the numeral starts fading the instant it appears and is under the letterform
 * bar by a quarter of the way up — measurably, `ink.test.ts` computes the
 * crossing. At 1.6 it is opaque for the first 37% of the rise and above the bar
 * for just over half of it, and it still dissolves to nothing at the same
 * moment it always did. A confirmation a child cannot read is not a
 * confirmation.
 */
export const FLOAT_HOLD = 1.6;

/**
 * The worst letterform contrast this pair presents over `surfaces`.
 *
 * One fragment carries both colours — `mix(halo, ink, t.r)` at `t.a * vAlpha` —
 * so the glyph and the ring around it are each composited against the SURFACE
 * at their own alpha, and it is the pair of results that the eye resolves the
 * shape of the digit from. `alpha` is the instance alpha, which is 1 for
 * everything except a float text dissolving as it rises.
 */
export function letterformEdge(pair: InkPair, surfaces: readonly RGB[], alpha = 1): number {
  let worst = Infinity;
  for (const s of surfaces) {
    const halo = over(pair.halo, s, HALO_ALPHA * alpha);
    const ink = over(pair.ink, s, alpha);
    worst = Math.min(worst, contrast(ink, halo));
  }
  return worst;
}

/**
 * The worst object-contrast an ink/halo pair presents over `surfaces`.
 *
 * Per surface the better of the two edges, because an inked blob is visible if
 * EITHER the glyph or the ring around it separates from the ground; the minimum
 * over every surface is the number `MIN_OBJECT` is asserted against.
 */
export function worstEdge(pair: InkPair, surfaces: readonly RGB[]): number {
  let worst = Infinity;
  for (const s of surfaces) {
    worst = Math.min(worst, Math.max(contrast(pair.ink, s), contrast(pair.halo, s)));
  }
  return worst;
}

/**
 * The best contrast ANY single opaque ink could reach against all of
 * `surfaces` — the ceiling a lone `fillText` works under.
 *
 * Contrast depends on an ink only through its luminance, so scanning the 256
 * greys bounds every colour: no hue beats the grey of the same luminance.
 */
export function bestSingleInk(surfaces: readonly RGB[]): number {
  let best = 0;
  for (let v = 0; v <= 255; v++) {
    const ink: RGB = [v / 255, v / 255, v / 255];
    let worst = Infinity;
    for (const s of surfaces) worst = Math.min(worst, contrast(ink, s));
    best = Math.max(best, worst);
  }
  return best;
}

/**
 * The best contrast any single ADDITIVE ink could reach — the ceiling the
 * shipped numerals worked under, and the reason this file exists.
 *
 * An additive glyph can only ever brighten what is behind it, so its edge
 * against a surface `s` is `contrast(min(1, s + ink), s)`. Where `s` is already
 * at 1.0 that is 1.00:1 for every ink there is, and the scan says so.
 */
export function bestAdditiveInk(surfaces: readonly RGB[]): number {
  let best = 0;
  for (let v = 0; v <= 255; v++) {
    const ink: RGB = [v / 255, v / 255, v / 255];
    let worst = Infinity;
    for (const s of surfaces) worst = Math.min(worst, contrast(add(ink, s), s));
    best = Math.max(best, worst);
  }
  return best;
}

/** What the SHIPPED scheme measured: an additive ink of `ink` over `surfaces`. */
export function additiveEdge(ink: RGB, surfaces: readonly RGB[]): number {
  let worst = Infinity;
  for (const s of surfaces) worst = Math.min(worst, contrast(add(ink, s), s));
  return worst;
}

// --------------------------------------------------------------- the palette
//
// The shader's own colours. `shaders.ts` interpolates these into `COMMON`, so
// the catalogue below and the GLSL that paints the pixels cannot disagree.

export const PAL = {
  posA: [1.0, 0.8, 0.28] as RGB,
  posB: [1.0, 0.38, 0.06] as RGB,
  negA: [0.22, 0.86, 1.0] as RGB,
  negB: [0.44, 0.28, 1.0] as RGB,
  neuA: [0.8, 0.83, 0.92] as RGB,
} as const;

/** The seal orb, as the fragment shader draws it. */
export const ORB = {
  r: 0.86,
  body: 0.68,
  rim: 0.075,
  rimAmp: 1.4,
  collar: 1.16,
  collarTh: 0.045,
} as const;

/** The charge plate — the other bullet that carries a printed numeral. */
export const CHG = { r: 0.92, body: 0.8, rim: 0.1 } as const;

/** The additive glow every bullet wears, on every tier. */
export const HALO = { r: 0.9, k: 2.6, amp: 0.55 } as const;

/** How the three layers are mixed into the fragment's colour. */
export const MIXW = { body: 0.9, rim: 1.5 } as const;

/** The Warden hull, which prints the total its lock demands. */
export const WARD = { r: 1.0, shell: 0.075, haloR: 0.95, haloK: 3.0, haloAmp: 0.3 } as const;

// -------------------------------------------------------------- the backdrop
//
// Not sampled: the backdrop fragment is a sum of independent terms and what the
// catalogue needs is its RANGE, so the terms are added at their extremes. Dim
// is the vignette floor with nothing lit; bright is every term at once — the
// grid line, the nebula band, the overload floor glow and the grain — which is
// what the bottom of the field looks like at a full core band.

function backdropSet(pol: RGB): RGB[] {
  const base: RGB = [0.026, 0.016, 0.036];
  const dim: RGB = scale(base, 0.35);
  // every term at once: the polarity wash, a grid line, the nebula band, the
  // overload floor glow and the grain — the bottom of the field at a full band.
  const grid = mix([0.1, 0.34, 0.62], pol, 0.35);
  const overload: RGB = [1.0, 0.25, 0.3];
  const bright = ([0, 1, 2] as const).map(
    (i) => base[i] + pol[i] * 0.03 + grid[i] * 0.26 + pol[i] * 0.022 + overload[i] * 0.22 + 0.007,
  ) as unknown as RGB;
  return [dim, base, mix(dim, bright, 0.5), bright];
}

// --------------------------------------------------------- the fragment port
//
// A port of the branches of `BULLET_FRAG` and `ENEMY_FRAG` that carry numerals.
// Every constant it uses is imported from the block above, which is the same
// block the GLSL is built from.

const aa = (d: number, w: number): number => 1 - smoothstep(-w, w, d);

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** `ngon` from `COMMON`: a regular n-gon as a radius-like scalar. */
function ngon(x: number, y: number, n: number, rot: number): number {
  const a = Math.atan2(y, x) - rot;
  const k = (Math.PI * 2) / n;
  const m = ((((a + k * 0.5) % k) + k) % k) - k * 0.5;
  return Math.hypot(x, y) * (Math.cos(m) / Math.cos(k * 0.5));
}

/**
 * The colour a seal orb or a charge plate contributes at local point (x, y).
 *
 * `pull` is the magnet state — a charge bullet being sucked into the ship, which
 * triples its halo and lights its body. Orbs are never pulled (`PLAYER.absorb`
 * is documented as never reaching them), which is why they are only ever
 * sampled at zero.
 */
function bulletAt(
  kind: "orb" | "charge",
  pol: 1 | -1,
  x: number,
  y: number,
  w: number,
  pull: number,
): RGB {
  const A = pol > 0 ? PAL.posA : PAL.negA;
  const B = pol > 0 ? PAL.posB : PAL.negB;
  const r = Math.hypot(x, y);
  if (r > 3) return [0, 0, 0];
  let body: number;
  let rim: number;
  if (kind === "orb") {
    const d = (pol > 0 ? ngon(x, y, 6, 0) : r) - ORB.r;
    body = aa(d, w) * ORB.body;
    rim = aa(Math.abs(d) - ORB.rim, w) * ORB.rimAmp;
    const coll = Math.abs(r - ORB.collar) - ORB.collarTh;
    rim += aa(coll, w) * (0.5 + 0.5 * Math.sin(Math.atan2(y, x) * 8));
  } else {
    const d = (pol > 0 ? ngon(x, y, 4, 0.785) : r) - CHG.r;
    body = aa(d, w) * CHG.body;
    rim = aa(Math.abs(d) - CHG.rim, w);
  }
  const halo = Math.exp(-Math.max(0, r - HALO.r) * HALO.k) * HALO.amp;
  const col: RGB = [0, 1, 2].map((i) => {
    const j = i as 0 | 1 | 2;
    return (
      B[j] * body * MIXW.body +
      A[j] * rim * MIXW.rim +
      A[j] * halo * (0.5 + pull) +
      A[j] * pull * 0.7 * body
    );
  }) as unknown as RGB;
  const a = Math.min(1, Math.max(Math.max(body, rim * 1.1), halo));
  return scale(col, a);
}

/** The colour the Warden hull contributes at local point (x, y). */
function wardenAt(pol: 1 | -1, x: number, y: number, w: number, t: number, hurt: number): RGB {
  const A = pol > 0 ? PAL.posA : PAL.negA;
  const r = Math.hypot(x, y);
  if (r > 2.4) return [0, 0, 0];
  const o = ngon(x, y, 8, 0) - WARD.r;
  let shell = aa(Math.abs(o) - WARD.shell, w);
  shell += aa(Math.abs(ngon(x, y, 4, t * 0.4) - 0.7) - 0.045, w) * 0.9;
  shell += aa(Math.abs(r - 0.34) - 0.05, w);
  const halo = Math.exp(-Math.max(0, r - WARD.haloR) * WARD.haloK) * WARD.haloAmp;
  const col: RGB = [0, 1, 2].map((i) => {
    const j = i as 0 | 1 | 2;
    return (
      A[j] * shell * (1.3 + hurt * 0.9) +
      mix([0, 0, 0], [1.0, 0.35, 0.32], hurt * 0.5)[j] * shell * 0.5 +
      A[j] * halo
    );
  }) as unknown as RGB;
  const a = Math.min(1, Math.max(shell, 0) + halo);
  return scale(col, a);
}

// ------------------------------------------------------------- the catalogue

/**
 * The classes of numeral this pack prints. Each one is a different object with
 * a different ground, which is the entire point of deriving rather than fixing:
 * "one colour that works on the orb" is what shipped.
 */
export type LabelClass =
  | "orbPos"
  | "orbNeg"
  | "chargePos"
  | "chargeNeg"
  | "floatPos"
  | "floatNeg"
  | "wardenLock"
  | "prompt";

export const LABEL_CLASSES: readonly LabelClass[] = [
  "orbPos",
  "orbNeg",
  "chargePos",
  "chargeNeg",
  "floatPos",
  "floatNeg",
  "wardenLock",
  "prompt",
];

/**
 * The antialias widths a fragment is evaluated at, which is where SCREEN SIZE
 * enters the table.
 *
 * `w` is `max(0.012, clamp(uPx / size, 0.004, 0.9) * 1.6)` and `uPx` is world
 * units per device pixel, so it is the whole of the device in one number: 0.012
 * is the shader's own floor and what a desktop or a retina tablet reaches,
 * 0.031 is the founder's 1080 × 2340 phone, and 0.09 is a 320 × 568 phone at
 * dpr 1 — the smallest screen this program supports. A soft edge is a wide band
 * of intermediate colour, so sampling all three is what puts the in-between
 * surfaces of a small screen into the catalogue instead of only the crisp ones.
 */
export const AA_WIDTHS: readonly number[] = [0.012, 0.031, 0.09];

/**
 * The additive lifts that land on a numeral AFTER its own object is drawn.
 *
 * In order: nothing; then the `UnrealBloomPass` on the `ultra` tier, which
 * runs at strength 0.55 to 1.55 over a blurred copy of the frame and therefore
 * adds back a fraction of the object's own colour on top of it, bounded here at
 * all of it; then the full-screen flash in `FRONT_FRAG`, which is a whiteout by
 * design and is why `WHITE` is in every catalogue.
 *
 * A NEIGHBOURING orb's halo is deliberately not a term any more, and that is a
 * measured absence rather than an assumed one: with the lane keeping in
 * `seal.ts` the closest two orbs come is one lane width, 3.9 orb radii, where
 * `exp(-(3.9 - 0.9) * 2.6) * 0.55` is 0.0002 — four thousandths of a percent.
 * Before it, three orbs sat inside one another and their halos added.
 *
 * None of this is what makes the shipped scheme unfixable, though, and that is
 * worth being exact about: an orb's own rim is `A * rim * 1.5` with `rim`
 * reaching 1.4, which clips a channel on its own. `bestAdditiveInk` over the
 * catalogue with NO lift at all is still 1.007:1. The founder's third orb needs
 * no neighbour and no bloom to explain it — a numeral crossing the orb's own
 * rim was additive ink on a surface that was already at 1.0.
 *
 * They are LIFTS and not replacements because every one of them is composited
 * with `src * srcAlpha + dst` — the framebuffer keeps what was already there
 * and gains this on top, clamped at 1.0. Which is exactly why the third orb has
 * no numeral: at the top of this list there is nothing left to add.
 */
function liftsFor(glow: RGB, flash: boolean): readonly RGB[] {
  const steady: RGB[] = [
    [0, 0, 0],
    scale(glow, 0.25),
    scale(glow, 0.55),
    scale(glow, 1.0),
  ];
  return flash ? [...steady, scale(WHITE, 0.5), WHITE] : steady;
}

/** The label quad's half-extent, in the units the object's fragment uses. */
function labelRect(cls: LabelClass): { hx: number; hy: number } {
  // `renderer.ts`: an orb's label is drawn at `r * 1.35`, a charge's at
  // `r * 1.55`, the Warden's at `r * 1.15`, each times `LABEL_ASPECT` wide and
  // times a 1.18 boost on a narrow screen; the object's own fragment is in
  // units of its radius. The boosts do not cancel — the bullet's is 1.22 — so
  // the widest relative label is the unboosted one, and that is what is used.
  const aspect = 2.25;
  if (cls === "wardenLock") return { hx: (1.15 * aspect) / 2, hy: 1.15 / 2 };
  if (cls === "chargePos" || cls === "chargeNeg") return { hx: (1.55 * aspect) / 2, hy: 1.55 / 2 };
  return { hx: (1.35 * aspect) / 2, hy: 1.35 / 2 };
}

/**
 * How much of the additive stack a catalogue includes.
 *
 *   - `"none"` — the DOMINANT GROUND: the object and the field, and nothing
 *     composited on top. This is what picks the pole, for the reason
 *     `balance/src/ink.ts` gives: a surface that is under the glyph for a
 *     hundred milliseconds of a flash should not get an equal vote with the
 *     body of the thing the numeral is written on.
 *   - `"glow"` — the STEADY state: plus the object's own halo, a neighbour's,
 *     and the `ultra` bloom. Everything that is on the glass continuously. This
 *     is what the "before" column is measured against, because the founder's
 *     third orb was not mid-flash — it was just sitting there.
 *   - `"flash"` — everything, including the whiteout in `FRONT_FRAG`. The bars
 *     are asserted against this.
 */
export type Lift = "none" | "glow" | "flash";

/**
 * EVERY surface a numeral of this class can land on.
 *
 * The object's own fragment, evaluated on a grid over the exact rectangle the
 * label quad covers, composited over each backdrop extreme, at each of the
 * antialias widths a real device produces — then every one of those lifted by
 * each of `LIFTS`. Float texts and the prompt have no object of their own, so
 * their ground is the field: the backdrop, plus a bullet's halo, because a
 * float text rises through whatever it was spawned on top of.
 */
export function surfacesFor(
  cls: LabelClass,
  lift: Lift = "flash",
  widths: readonly number[] = AA_WIDTHS,
): RGB[] {
  const pol: 1 | -1 = cls.endsWith("Neg") ? -1 : 1;
  const A = pol > 0 ? PAL.posA : PAL.negA;
  const back = backdropSet(A);
  const lifts = lift === "none" ? [[0, 0, 0] as RGB] : liftsFor(A, lift === "flash");
  const out: RGB[] = [];
  const push = (s: RGB): void => {
    for (const l of lifts) out.push(add(l, s));
  };

  if (cls === "floatPos" || cls === "floatNeg" || cls === "prompt") {
    // No hull of its own. It rises through the field, and the field's brightest
    // thing that is not an object is a bullet's halo at full strength.
    for (const b of back) {
      push(b);
      push(add(scale(A, HALO.amp), b));
    }
    return out;
  }

  const { hx, hy } = labelRect(cls);
  const N = 13;
  for (const w of widths) {
    for (let iy = 0; iy < N; iy++) {
      const y = -hy + (2 * hy * iy) / (N - 1);
      for (let ix = 0; ix < N; ix++) {
        const x = -hx + (2 * hx * ix) / (N - 1);
        const pulls = cls.startsWith("charge") ? [0, 1] : [0];
        for (const pull of pulls) {
          const obj =
            cls === "wardenLock"
              ? wardenAt(pol, x, y, w, 0, 0)
              : bulletAt(cls.startsWith("orb") ? "orb" : "charge", pol, x, y, w, pull);
          for (const b of back) push(add(obj, b));
        }
      }
    }
  }
  if (cls === "wardenLock") {
    // A hit flash whites the hull out for a few frames, and the rotating inner
    // ring means the sample grid alone misses phases of the hull.
    for (const t of [1.6, 3.1]) {
      for (let iy = 0; iy < 5; iy++) {
        const y = -hy + (2 * hy * iy) / 4;
        for (let ix = 0; ix < 9; ix++) {
          const x = -hx + (2 * hx * ix) / 8;
          push(add(wardenAt(pol, x, y, 0.031, t, 1), back[1] as RGB));
        }
      }
    }
  }
  return out;
}

/** The ink and halo a numeral of this class is drawn in. Derived, once. */
const CACHE = new Map<LabelClass, InkPair>();

export function labelInk(cls: LabelClass): InkPair {
  const hit = CACHE.get(cls);
  if (hit) return hit;
  const pair = inkPairFor(surfacesFor(cls, "none"));
  CACHE.set(cls, pair);
  return pair;
}

/** Which class a bullet's numeral belongs to. */
export function classOfBullet(isOrb: boolean, v: number): LabelClass {
  if (isOrb) return v < 0 ? "orbNeg" : "orbPos";
  return v < 0 ? "chargeNeg" : "chargePos";
}

/** Which class a rising float text belongs to. */
export function classOfFloat(v: number): LabelClass {
  return v < 0 ? "floatNeg" : "floatPos";
}

/** A row of the legibility table: what shipped, and what ships now. */
export type InkRow = {
  cls: LabelClass;
  /** the ceiling for ANY additive ink — what the shipped scheme could reach */
  additiveCeiling: number;
  /** what the shipped `polHot`/`gold` additive tint actually measured */
  before: number;
  /** the ceiling for any single opaque ink, i.e. recolouring alone */
  singleCeiling: number;
  /** ink against its own halo */
  letterform: number;
  /** the inked blob against the worst surface it lands on */
  object: number;
  pole: "light" | "dark";
};

/** What the shipped numeral of each class was tinted. `constants.ts` colours. */
const SHIPPED: Record<LabelClass, RGB> = {
  orbPos: [1.0, 0.97, 0.86],
  orbNeg: [0.83, 0.95, 1.0],
  chargePos: [1.0, 0.97, 0.86],
  chargeNeg: [0.83, 0.95, 1.0],
  floatPos: [1.0, 0.97, 0.86],
  floatNeg: [0.83, 0.95, 1.0],
  wardenLock: [1.0, 0.88, 0.5],
  prompt: [1.0, 0.88, 0.5],
};

export function inkRow(cls: LabelClass): InkRow {
  const steady = surfacesFor(cls, "glow");
  const everything = surfacesFor(cls, "flash");
  const pair = labelInk(cls);
  return {
    cls,
    additiveCeiling: bestAdditiveInk(steady),
    before: additiveEdge(SHIPPED[cls], steady),
    singleCeiling: bestSingleInk(steady),
    letterform: letterformEdge(pair, everything),
    object: worstEdge(pair, everything),
    pole: pair.ink === INK_LIGHT ? "light" : "dark",
  };
}

export const inkTable = (): InkRow[] => LABEL_CLASSES.map(inkRow);

export { WHITE };
