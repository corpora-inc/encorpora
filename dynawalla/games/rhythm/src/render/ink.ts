/**
 * WHAT THE QUESTION LANDS ON.
 *
 * The founder, on the failure screen: *"the problem on 'restart the heart'
 * doesn't have enough contrast."*
 *
 * He is right, and the number is **2.30:1**. Here is how it happened, because
 * the mechanism matters more than the fix: `drawHud` painted the question in
 * `#ffffff` inside an `rgba(4,6,18,0.82)` box — **19.78:1**, one of the most
 * legible things in the pack — and then, thirty lines further down, the
 * breakdown overlay painted `rgba(3,4,12,0.72)` **over the entire canvas**,
 * question included. The white glyph composited down to `rgb(74,74,80)` and the
 * box under it to `rgb(4,5,16)`. Nobody chose a low-contrast colour. The
 * contrast was destroyed by a later draw call, which is exactly the class of
 * defect that eyeballing a palette cannot find and measuring a composite can.
 *
 * (`games/balance/src/ink.ts` found the same class of thing on its brass
 * weights, by the same method. The generic half of both files — `luma`,
 * `contrast`, `over`, `plus`, and the two bars — is now written twice and
 * should be lifted into `packs/shared`; see the PR.)
 *
 * ## The two bars
 *
 *   1. **Letterform, 4.5:1.** The glyph against the panel that rings it. WCAG AA
 *      body text, held at the body-text number rather than the 3:1 large-text
 *      allowance because the reader is a child doing arithmetic under time.
 *   2. **Object, 3.0:1.** The panel against whatever it is lying on. WCAG 1.4.11
 *      non-text contrast.
 *
 * Everything below is built from the same literals the renderer paints with, in
 * the same order, with the same alphas — so a future scrim cannot be added
 * without this file's numbers moving.
 */

export type RGB = readonly [number, number, number];

/** Glyph against the panel behind it. WCAG AA body text. */
export const MIN_LETTERFORM = 4.5;
/** Panel against the ground it lies on. WCAG 1.4.11 non-text contrast. */
export const MIN_OBJECT = 3.0;

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
  const m = (i: 0 | 1 | 2): number => Math.round(src[i]! * alpha + dst[i]! * (1 - alpha));
  return [m(0), m(1), m(2)];
}

/** `globalCompositeOperation = "lighter"` at `alpha` — additive, clamped. */
export function plus(src: RGB, dst: RGB, alpha: number): RGB {
  const m = (i: 0 | 1 | 2): number => Math.min(255, Math.round(src[i]! * alpha + dst[i]!));
  return [m(0), m(1), m(2)];
}

/* ------------------------------------------------------- the shipped literals */

/** `drawHud`: the question panel, `roundRect` + `fill`. */
export const PROMPT_PANEL: RGB = [4, 6, 18];
export const PROMPT_PANEL_ALPHA = 0.82;

/**
 * …and the stroke around it.
 *
 * **The object bar is carried by this and not by the panel, and that is
 * arithmetic rather than a preference.** The panel is a near-black
 * `rgb(4,6,18)`; the violet sector's sky top is `rgb(15,5,28)`, whose relative
 * luminance is 0.0029 against the panel's 0.0020. Those are 1.01:1 apart, and
 * NO opacity fixes it — at alpha 1.0 the panel is still 1.02:1, because the two
 * colours are simply the same darkness. A near-black panel cannot separate
 * itself from a near-black sky by being more of a panel.
 *
 * So the panel is measured the way `games/balance/src/ink.ts` measures an inked
 * blob: the better of its two edges. The stroke is a bright accent at 55% over
 * whatever is behind it, and IT is what a reader's eye finds the box by. Every
 * sector's `horizon` is therefore part of this claim, which is the right
 * coupling — warm up a sector's accent and this number moves.
 *
 * **0.9, raised from the shipped 0.55, because the shipped value did not clear
 * the bar.** The measurement, per sector, at the panel's best edge:
 *
 *   | stroke alpha | worst  | where  |
 *   |--------------|--------|--------|
 *   | 0.55 (shipped) | 2.68:1 | violet |
 *   | 0.70         | 3.44:1 | violet |
 *   | 0.90         | 4.57:1 | solar  |
 *
 * The violet sector is the hard one: its sky bottom takes an additive bloom of
 * `rgb(170,70,255)` and lands at `rgb(79,27,126)`, which is close enough to its
 * own `rgb(214,150,255)` accent that a 55% border almost disappears into it.
 * Nobody would have found that by looking at the indigo sector, which is where
 * every run starts.
 */
export const PROMPT_STROKE_ALPHA = 0.9;

/** `drawNotes`: an answer tile's panel. */
export const TILE_PANEL: RGB = [6, 9, 22];
export const TILE_PANEL_ALPHA = 0.93;

/** Every glyph in the gate surface is painted in this. */
export const GLYPH: RGB = [255, 255, 255];

/**
 * The scrim the deleted breakdown overlay laid over the finished canvas.
 *
 * Kept, unused by the renderer, precisely so `legibility.test.ts` can measure
 * what it did and fail if anything ever puts it back.
 */
export const DEAD_BREAKDOWN_SCRIM: RGB = [3, 4, 12];
export const DEAD_BREAKDOWN_SCRIM_ALPHA = 0.72;

/**
 * Every sky a gate can be read against.
 *
 * The renderer paints a vertical gradient from `skyTop` to `skyBottom` per
 * sector, and a gate can be on screen in any of them, so all twelve stops are
 * ground. Taken from `theme.ts` rather than re-typed: warming up a sector must
 * move these numbers.
 */
export type SectorSurfaces = {
  id: string;
  /** every ground a gate can be read against IN THIS SECTOR */
  grounds: RGB[];
  /** the accent this sector strokes and glows with */
  accent: RGB;
};

/**
 * The skies, GROUPED BY SECTOR.
 *
 * Grouping is not tidiness. The panel's stroke is `rgba(th.horizon, …)` — the
 * CURRENT sector's accent — so a sector's sky is only ever seen behind its own
 * accent. Measuring every accent against every sky invents pairings the
 * renderer cannot produce, and a first draft of the legibility test did exactly
 * that and reported a 2.75:1 that no player can ever be shown.
 */
export function sectors(
  themes: Record<string, { skyTop: RGB; skyBottom: RGB; horizon: RGB; bloom: RGB }>,
): SectorSurfaces[] {
  return Object.entries(themes).map(([id, t]) => ({
    id,
    // the bloom haze behind the strike column is additive at its strongest
    grounds: [t.skyTop, t.skyBottom, plus(t.bloom, t.skyBottom, 0.22)],
    accent: t.horizon,
  }));
}

/** Every ground in every sector, flattened — for claims that are accent-free. */
export function skies(themes: Record<string, { skyTop: RGB; skyBottom: RGB; horizon: RGB; bloom: RGB }>): RGB[] {
  return sectors(themes).flatMap((s) => s.grounds);
}

/** The panel the question is actually read on, over each sky. */
export function promptPanels(sky: readonly RGB[]): RGB[] {
  return sky.map((s) => over(PROMPT_PANEL, s, PROMPT_PANEL_ALPHA));
}

/** The panel an answer tile's label is read on, over each sky. */
export function tilePanels(sky: readonly RGB[], laneColors: readonly RGB[]): RGB[] {
  const out: RGB[] = [];
  for (const s of sky) {
    for (const lane of laneColors) {
      // the lane's glow sprite is drawn additively under the panel at 0.45
      const lit = plus(lane, s, 0.45);
      out.push(over(TILE_PANEL, lit, TILE_PANEL_ALPHA));
    }
    out.push(over(TILE_PANEL, s, TILE_PANEL_ALPHA));
  }
  return out;
}

/** Put a scrim over an already-composited surface AND over the glyph on it. */
export function underScrim(panel: RGB, glyph: RGB, scrim: RGB, alpha: number): { panel: RGB; glyph: RGB } {
  return { panel: over(scrim, panel, alpha), glyph: over(scrim, glyph, alpha) };
}

/** The worst letterform contrast this glyph has over any of `panels`. */
export function worstLetterform(glyph: RGB, panels: readonly RGB[]): number {
  let worst = Infinity;
  for (const p of panels) worst = Math.min(worst, contrast(glyph, p));
  return worst;
}

/**
 * The worst object contrast a bordered panel presents over its grounds.
 *
 * Per ground, the BETTER of the two edges — the fill's own contrast or the
 * stroke's — because a bordered box is found by whichever of the two separates.
 * See `PROMPT_STROKE_ALPHA` for why the fill alone provably cannot.
 */
export function worstPanelEdge(
  sectorList: readonly SectorSurfaces[],
  fill: RGB,
  fillAlpha: number,
  strokeAlpha: number,
): { ratio: number; sector: string } {
  let worst = Infinity;
  let where = "";
  for (const sec of sectorList) {
    const stroke = over(sec.accent, [0, 0, 0], 1);
    for (const s of sec.grounds) {
      const best = Math.max(
        contrast(over(fill, s, fillAlpha), s),
        contrast(over(stroke, s, strokeAlpha), s),
      );
      if (best < worst) {
        worst = best;
        where = sec.id;
      }
    }
  }
  return { ratio: worst, sector: where };
}
