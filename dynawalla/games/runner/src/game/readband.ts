/**
 * Where the three gate candidates go, in screen units.
 *
 * The single most important function in this game, because it is the one that
 * decides whether a child can read the question at all. It is pure arithmetic
 * with no THREE in sight so that `readband.test.ts` can hammer it with every
 * viewport and every candidate width the game can produce and assert the two
 * properties that actually matter:
 *
 *   1. adjacent numerals never touch — there is always a gutter wider than a
 *      digit stroke, so 13 | 42 | 36 can never render as "134236";
 *   2. nothing leaves the viewport — including the third numeral on a 320px
 *      phone, which used to be clipped clean off the right edge.
 *
 * Everything is NDC: x and y run -1..+1 across the viewport, so "0.5" means a
 * quarter of the screen's width regardless of device, orientation or DPR. The
 * caller converts back to world space with `Projector`.
 *
 * ── the row belongs to the gate ─────────────────────────────────────────────
 *
 * It did not. The founder's screenshot, and then the arithmetic: on a 360x780
 * phone the outer candidate was drawn at x = 305px for the *entire* approach,
 * while the arch it names travelled from 198px to 286px; it was 98px tall from
 * the moment it appeared to the moment it was crossed, while the arch grew from
 * 27px to 158px; and it sat 27px clear above the lintel throughout. Worse, the
 * chase camera follows the player at 0.6x, so steering slid the whole gate
 * cluster sideways under a row that was pinned to the middle of the glass — at
 * four units out, with the child in the left lane, the outer numeral was 44px
 * to the *wrong side* of its own arch.
 *
 * Three numbers, none of which was a function of the gate. "Which lane says
 * what" was a guess supported by left-to-right order and a line of dots.
 *
 * So the row is now derived from the gate's own projected geometry — its centre,
 * its lane pitch, the height of its arch — and falls back on the legibility
 * floors only where the geometry cannot honour them. Far out, the arch is 16px
 * wide and no readable numeral fits in it, so the row is a legible board held
 * above the gate; as the gate closes the pitch, the size and the height all
 * converge and each numeral settles into its own window and travels with it.
 * Choosing a lane and choosing an answer become the same act, which is the whole
 * design of the game.
 *
 * The floors are not negotiable and are asserted here: a numeral that sits
 * prettily on an arch at eleven pixels is the bug this file was written to kill,
 * and it killed it once already.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const BAND = {
  /**
   * The share of the pitch a numeral's ink may occupy. The remaining 30% is
   * gutter, and it is the whole reason this file exists. Do not raise it.
   */
  fill: 0.7,
  /**
   * ...and a floor on that gutter in absolute NDC, because `fill` alone is a
   * *ratio*: it keeps a wide numeral apart and lets three small ones close to
   * within a couple of pixels of each other. Since the row now shrinks with its
   * gate, small is the common case.
   */
  gutter: 0.14,
  /** Ceiling on apparent size, in NDC y. A single digit would otherwise fill the screen. */
  maxH: 0.3,
  /**
   * Cap height, in CSS pixels, below which a numeral stops being an answer.
   *
   * The floor the row falls back on when its gate is too far away to carry a
   * readable numeral. 46px is a shade over the 44px the two named legibility
   * tests demand, so the margin is visible in the constant rather than implied
   * by one. It is in *pixels*, not NDC, because legibility is: 0.1 NDC is 39px
   * on a 780-tall phone and 108px on a desktop.
   */
  minCapPx: 46,
  /**
   * Share of its window's height a numeral standing in one may fill.
   *
   * 0.62 leaves a visible margin of arch above and below the ink, which is what
   * makes it read as framed by the gate rather than jammed into it.
   */
  archShare: 0.62,
  /** Hard page margin on a device with no insets: no ink past |x| = this. */
  edge: 0.94,
  /** The row never rises past here — above it lives the prompt. */
  top: 0.56,
  /** Clear air between the numeral row and the top of its own gate arch. */
  lift: 0.07,
} as const;

/**
 * The rectangle the numeral row is allowed to occupy, in NDC.
 *
 * **Why this is an argument and not a constant.** `BAND.edge` used to be the
 * page margin, full stop: 0.94, three per cent of half the screen. On a phone
 * held sideways the display cutout and the rounded corners eat far more than
 * that — 47 CSS pixels of an 844-wide viewport is five and a half per cent, so
 * the outer candidate reached about twenty pixels *into* the cutout. In this
 * game the outer candidate is an answer. A digit the child cannot read is a
 * wrong answer they did not choose.
 *
 * It is required rather than defaulted for the same reason. A default is a
 * game that forgets the insets, compiles clean, and is discovered on a device.
 * `chrome.ts` builds one of these from the measured safe area.
 */
export type Frame = {
  /** No ink past |x| = this. */
  edge: number;
  /** The row's top edge never rises above this NDC y. */
  top: number;
  /**
   * The row's bottom edge never sinks below this NDC y.
   *
   * This is the HUD's own bottom furniture — the voltage bar, plus whatever the
   * system has taken off the bottom edge — and nothing else. It used to be a
   * flat 0.06, "roughly the horizon", which is the wrong shape of limit: the
   * horizon is a property of the *gate's depth*, not of the screen, and a flat
   * screen-space floor is exactly what stopped the row descending into its own
   * window at mid range. The deck now bounds the row from `GateGeom.deck`,
   * measured at the gate.
   */
  bottom: number;
  /**
   * Floor on the row's ink height, in NDC, for this surface.
   *
   * `BAND.minCapPx` resolved against the viewport height. Carried on the frame
   * rather than computed here because this file never learns how tall the
   * surface is — everything else it does is scale-free.
   */
  minH: number;
};

/** The frame on a surface of height `vh` with no insets at all. */
export function fullFrame(vh: number): Frame {
  return {
    edge: BAND.edge,
    top: BAND.top,
    bottom: -1,
    minH: (2 * BAND.minCapPx) / Math.max(1, vh),
  };
}

/**
 * The gate the row belongs to, in NDC, at the depth it currently sits at.
 *
 * Every field is a projection of something the child can see, and that is the
 * point: the row is laid out *from the gate* and only clamped by the frame.
 */
export type GateGeom = {
  /**
   * NDC x of the gate's middle lane.
   *
   * Not zero. The chase camera follows the player at 0.6x, so the gate cluster
   * slides across the glass as the child steers, and a row centred on the
   * screen leaves its arches behind.
   */
  centre: number;
  /** NDC x between adjacent lane centres, magnitude. */
  lanePitch: number;
  /** NDC y of the top of the arch — the underside of the lintel. */
  archTop: number;
  /** NDC height of the arch, deck to lintel. */
  archH: number;
  /** NDC y of the deck at the gate's depth. The row never sinks below it. */
  deck: number;
};

export type Band = {
  /** Ink height, in NDC y. Multiply by `1/|ky|` for world units. */
  hNdc: number;
  /** NDC x of each candidate's centre, left to right. */
  x: [number, number, number];
  /** NDC y of the row's centre. */
  y: number;
  /** NDC x between adjacent centres. */
  pitch: number;
  /** NDC width of the widest candidate at `hNdc`. */
  wNdc: number;
  /**
   * How much of the row is standing in its window: 0 held above the lintel, 1
   * framed by the arch.
   *
   * The renderer fades the leader dots out with it — a leader from a numeral to
   * the arch it is already sitting in is a line of dots to nowhere.
   */
  onGate: number;
};

/**
 * @param units world width of each candidate at ink height 1, left to right
 * @param kx    NDC x per world unit at the gate's depth (magnitude)
 * @param ky    NDC y per world unit at the gate's depth (magnitude)
 * @param geom  the gate, in NDC — see `GateGeom`
 * @param frame the NDC rectangle the row may occupy — see `Frame`
 */
export function readBand(
  units: readonly [number, number, number],
  kx: number,
  ky: number,
  geom: GateGeom,
  frame: Frame,
): Band {
  const ax = Math.max(1e-6, Math.abs(kx));
  const ay = Math.max(1e-6, Math.abs(ky));

  // One size for all three. Three different sizes on one row reads as three
  // different kinds of thing, and the eye stops comparing them.
  const widest = Math.max(units[0], units[1], units[2], 1e-6);
  /** NDC width the widest candidate occupies per NDC of ink height. */
  const wPerH = Math.max(1e-6, (widest * ax) / ay);

  // The size the GATE asks for, floored at what a child can read. Far out the
  // floor wins and the row is bigger than the arch; from about twenty units the
  // arch wins and the row is a thing standing in a window.
  //
  // Bounded by the window in BOTH dimensions, which is not fussiness. Sizing off
  // the arch's height alone, a numeral on a tablet outgrew the arch's *width* on
  // the approach — the gutter rule then pushed the row wider than the lanes to
  // keep the ink apart, so the answers came unstuck again in the last twenty
  // units, on the larger screen only. `fill` rather than the window's full width
  // so that a numeral sized this way needs exactly the lane pitch and no more.
  const wantH = Math.min(
    geom.archH * BAND.archShare,
    (BAND.fill * geom.lanePitch) / Math.max(1e-6, wPerH),
  );
  let hNdc = Math.min(BAND.maxH, Math.max(frame.minH, wantH));
  let wNdc = hNdc * wPerH;

  // The widest a numeral can ever be: the point where the gutter rule
  // (w <= fill * pitch) and the page margin (pitch + w/2 <= edge) meet. A
  // three-digit answer on a 320px phone is held here, not by the floor above,
  // and that has always been the binding constraint for wide answers.
  const wCeil = (BAND.fill * frame.edge) / (1 + BAND.fill / 2);
  if (wNdc > wCeil) wNdc = wCeil;

  // The row sits on the lanes, and opens wider than them only when it must.
  let pitch = Math.max(geom.lanePitch, wNdc / BAND.fill, wNdc + BAND.gutter);
  const pitchCeil = frame.edge - wNdc / 2;
  if (pitch > pitchCeil) pitch = pitchCeil;
  wNdc = Math.min(wNdc, BAND.fill * pitch, Math.max(0, pitch - BAND.gutter));

  hNdc = wNdc / wPerH;
  const half = hNdc / 2;

  // Centred on the gate, and pulled back inside the page margin as a whole
  // rather than per numeral: the row is one object and a row whose left half is
  // clamped and right half is not is a row with an uneven pitch, which is the
  // one thing the gutter rule exists to prevent.
  const room = Math.max(0, frame.edge - (pitch + wNdc / 2));
  const centre = geom.centre < -room ? -room : geom.centre > room ? room : geom.centre;

  // Descend into the window as the window grows big enough to hold the row.
  // Continuous by construction: `onGate` is a ratio of two heights, so there is
  // no frame on which the numerals jump.
  const onGate = clamp01(geom.archH / Math.max(1e-6, hNdc));
  const above = geom.archTop + half + BAND.lift;
  const inside = geom.archTop - geom.archH / 2;
  let y = above + (inside - above) * onGate;

  // Never below the deck at the gate's own depth — under it a numeral lies on
  // the causeway instead of standing in a window — nor into the HUD's bottom
  // furniture, nor behind the prompt. When two limits collide the top wins: off
  // the bottom is invisible, slightly tight against the prompt is merely close.
  const lo = Math.max(frame.bottom, geom.deck) + half;
  const hi = frame.top - half;
  if (y < lo) y = lo;
  if (y > hi) y = hi;

  return { hNdc, x: [centre - pitch, centre, centre + pitch], y, pitch, wNdc, onGate };
}

/* -------------------------------------------------------------------------- */
/* The other two places ink can leave the frame.                              */
/* -------------------------------------------------------------------------- */

/**
 * Half-width, in NDC, that the winning numeral may fill as it rushes the camera.
 *
 * Slightly inside the frame: the glyph is allowed to feel like it is bursting
 * out of the screen, but a child has to be able to see *which number* won. Past
 * about 0.96 a two-digit answer on a phone stops being a number and starts being
 * a wall.
 */
export const PAYOFF_EDGE = 0.92;

/** The payoff's margin inside a frame: a shade tighter than the row's own. */
export const payoffEdge = (frameEdge: number): number => Math.min(PAYOFF_EDGE, frameEdge - 0.02);

/** Ceiling on the payoff numeral's NDC height, whatever the aspect ratio. */
export const PAYOFF_MAX_H = 1.55;

/**
 * How big the winning numeral is allowed to get, in NDC height.
 *
 * It used to swell to a flat 1.55 NDC *tall* and nothing looked at how wide that
 * made it. On a laptop a two-digit answer just fits; on a 390px phone it is 2.7
 * NDC wide against a 2.0 NDC screen, so the best moment in the game — the value
 * you just earned rushing the camera — became two unrecognisable green slabs
 * jammed against the left and right edges. Same rule as `readBand`: decide in
 * screen units, then convert back.
 *
 * @param wPerH NDC width the text occupies per NDC of height (aspect-corrected)
 * @param from  the numeral's NDC height when it left the row
 * @param swell 0 at the moment of crossing, 1 when fully arrived
 * @param edge  the page margin — `payoffEdge(frame.edge)`, never a constant,
 *              because in landscape the cutout sits inside the old constant
 */
export function payoffHeight(wPerH: number, from: number, swell: number, edge: number): number {
  const ceil = Math.min(PAYOFF_MAX_H, (2 * edge) / Math.max(1e-4, wPerH));
  // Belt and braces: the swell only ever runs upward. `readBand` already keeps
  // every candidate under 0.54 NDC wide, well inside this ceiling, so `from` is
  // never the larger of the two in practice — but a numeral that *shrank* on a
  // win would read as the game taking the prize back, and that should be
  // impossible by construction rather than by the row happening to be small.
  const to = Math.max(from, ceil);
  return from + (to - from) * clamp01(swell);
}

/** The margin a score popup is kept inside. Tighter than the payoff: it is chrome. */
export const POPUP_EDGE = 0.93;

/** The popup's margin inside a frame. */
export const popupEdge = (frameEdge: number): number => Math.min(POPUP_EDGE, frameEdge - 0.01);

/**
 * Nudge a centre back inside the frame, in NDC.
 *
 * Score popups are placed at the lane they belong to, which on a wide screen is
 * well inside the frame and on a 390px phone is not: a `+100` over the outer
 * lane used to hang half off the edge as a meaningless `00`. Text keeps its lane
 * as long as the lane fits, and gives that up rather than be unreadable.
 *
 * @param ndcX  where the text wants to be centred
 * @param halfW half the text's NDC width
 * @param edge  the hard page margin — `popupEdge(frame.edge)`, required for the
 *              same reason `readBand` requires a frame
 */
export function keepInside(ndcX: number, halfW: number, edge: number): number {
  const lim = Math.max(0, edge - Math.max(0, halfW));
  return ndcX < -lim ? -lim : ndcX > lim ? lim : ndcX;
}
