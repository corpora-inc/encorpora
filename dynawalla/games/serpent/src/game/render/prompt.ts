/**
 * Fitting the condition to the water it is written on.
 *
 * ## The defect this replaces
 *
 * The condition used to be drawn at `Math.max(56, view.scale * 0.52)` and blitted
 * at its natural width, measured against nothing. On a 320px phone that is a
 * 73px numeral inside an arena whose diameter is 282px at the surface and **175px
 * at `arenaFloor`** — so the string ran out of the disc it is clipped to and out
 * of the safe box, and the deeper a child dived the worse it got. It was already
 * wrong on the shipped ladder: `dw.mul.scale.times-power-of-ten` L2 serves
 * `42739 × 10000`, thirteen characters. It gets worse the moment any `alg` row
 * goes active, because `packs/shared/game-host` admits items by **domain** and
 * this pack declares `dw.alg.*` — `946 + □ = 1142` is fourteen.
 *
 * ## What replaces it
 *
 * A measured fit with a hard floor, and a break rather than a squash:
 *
 *   1. **Measured.** Every candidate is measured, at every size, against the
 *      *ink* extent (`labelInk`, not `labelWidth` — see the doc comment there).
 *   2. **Broken, not squashed.** A condition is a sentence about a relation, so
 *      it breaks where the mathematics breaks: `946 + □` over `= 1142`, never a
 *      horizontally compressed smear and never mid-token. A break is only ever
 *      allowed *before* an operator or a relation, so no line can end on one.
 *   3. **Floored.** `MIN_PROMPT_PX` is the bottom, and it is not negotiable.
 *      Shrinking past a legibility floor is not fitting, it is hiding: a sibling
 *      pack shipped a 15.1px answer under a bloom and the founder filed it as
 *      illegible. A condition that cannot reach the floor is drawn AT the floor,
 *      wrapped as far as it goes, and says so out loud — `fits: false`.
 *
 * ## Why the fit is a circle and not a rectangle
 *
 * The condition is drawn inside the arena's own clip (`scene.ts` clips to the
 * vent disc before writing on the water), so the boundary that actually cuts a
 * numeral in half is a circle, not the viewport. A block of width `w` and height
 * `h` centred on that disc fits exactly when its corners do:
 *
 *     (w/2)² + (h/2)² ≤ radius²
 *
 * which is also, read the other way, "`w` is no wider than the chord at `h/2`".
 * Fitting the bounding *square* instead would refuse sizes that are provably
 * legible, and fitting the width alone would clip the tops off two-line blocks.
 *
 * Everything here is arithmetic over numbers a test can supply, which is the
 * point: the widths are wrong on a device or they are wrong in `prompt.test.ts`,
 * and only one of those is discoverable.
 */

import { easeOutBack } from "../num.ts";
import { CAP_EM, type Ink } from "./glyphs.ts";

/**
 * The smallest cap height a condition may ever be drawn at, in CSS pixels.
 *
 * The repo's legibility audit sets 19px for a prompt and 15px for an answer
 * candidate. This is the prompt.
 */
export const MIN_PROMPT_PX = 19;

/** No condition is ever broken into more lines than this. */
export const MAX_PROMPT_LINES = 3;

/** Baseline-to-baseline of a broken condition, in ems. */
export const PROMPT_LINE_EM = 1.24;

/**
 * The relation glyphs a condition can turn on, and the operators.
 *
 * A line may begin with one of these and may never end with one, which is what
 * makes `946 + □` / `= 1142` the only two-line reading of that statement and
 * `946 +` / `□ = 1142` unreachable. U+2212 MINUS SIGN, U+00D7, U+00F7 — the
 * glyphs the curriculum actually writes; an ASCII hyphen is accepted too because
 * this pack's own stub host emits one in a negative literal's company.
 */
const RELATIONS: readonly string[] = ["=", "<", ">", "≤", "≥"];
const OPERATORS: readonly string[] = ["+", "−", "×", "÷", "-"];

/**
 * How the pop-in and the breathing scale the condition, this frame.
 *
 * Extracted from `scene.ts` so that `PROMPT_PEAK_SCALE` can be *checked* against
 * the expressions it claims to bound instead of being a number somebody believed.
 * `easeOutBack` overshoots, which is the whole reason a reserved headroom exists
 * at all: the largest the condition is ever drawn is not the size it was fitted
 * at.
 *
 * `halo` is the outer additive pass. It is deliberately outside the fit — it is
 * the same glyphs 8% larger at a tenth of the alpha, i.e. a glow, and clipping
 * the outer rim of a glow against the vent is invisible. The `core` pass is the
 * one a child reads and it is what the budget reserves for.
 */
export function promptDrawScale(
  promptT: number,
  camT: number,
): { core: number; halo: number; breathe: number } {
  const breathe = 1 + Math.sin(camT * 0.9) * 0.012;
  const inK = easeOutBack(Math.min(1, promptT * 1.25));
  const core = (0.74 + 0.26 * inK) * breathe;
  // `breathe` is handed back for the OUTGOING condition, which expands and fades
  // on its own curve but breathes with the same lungs.
  return { core, halo: core * 1.08, breathe };
}

/**
 * The largest `core` scale `promptDrawScale` can ever return.
 *
 * `promptBudget` divides by it, so the peak of the pop-in lands exactly on the
 * boundary rather than through it. Held against a sweep of the real expressions
 * in `prompt.test.ts` — if the animation is ever retuned, that test fails here
 * rather than a numeral overrunning the vent for two frames on a device.
 *
 * It is 1.039 and not 1.016, which is what this constant was first written as:
 * `easeOutBack` peaks at **1.0999**, not at the 1.014 an eyeball reading of it
 * suggests, so the settle overshoots by four percent rather than one and a half.
 * The sweep is the only reason that is known. Do not hand-derive it again.
 */
export const PROMPT_PEAK_SCALE = 1.039;

/**
 * How much of the vent disc the condition may use.
 *
 * `0.94` is two separate margins folded into one number, both measured:
 *   · `cam.zoom` is a spring (`1 + punch`), and the largest punch in `TUNE` is
 *     0.14 into a spring of stiffness 190, so the zoom undershoots to about
 *     0.990. The fit is computed from the *unzoomed* radius, so it has to hold
 *     when the disc is 1% smaller than it was measured.
 *   · the rim draws a white-hot lip just inside `arenaR`, and ink that touches
 *     the lip reads as ink that has hit the wall.
 */
const ARENA_USE = 0.94;

/** Clear air between the condition and the edge of the safe box. */
const SAFE_MARGIN = 8;

export type Rect = { x: number; y: number; w: number; h: number };

export type PromptBudget = {
  /** Radius of the disc the block must fit inside, peak headroom already taken. */
  radius: number;
  maxW: number;
  maxH: number;
};

export type PromptBlock = {
  lines: readonly string[];
  /** Cap height the block is drawn at, in CSS pixels. Never below the floor. */
  size: number;
  /** Ink extent of the whole block at `size`. */
  w: number;
  h: number;
  /** Each line's centre offset from the block's centre, in CSS pixels. */
  offsets: readonly number[];
  /**
   * `false` when even `MIN_PROMPT_PX`, wrapped as far as it wraps, does not fit.
   * The block is still drawn — a condition a child cannot see is a game with no
   * rule in it — but the caller shouts, because that is a curriculum row this
   * pack should not have been served.
   */
  fits: boolean;
};

/**
 * The disc and the box a condition has to live inside.
 *
 * `arenaPx` is `world.arenaR * view.scale` — the arena radius WITHOUT `cam.zoom`,
 * because a fit recomputed on a spring is a fit that jitters. `ARENA_USE` carries
 * the zoom undershoot instead.
 */
export function promptBudget(safe: Rect, arenaPx: number): PromptBudget {
  return {
    radius: Math.max(1, (arenaPx * ARENA_USE) / PROMPT_PEAK_SCALE),
    maxW: Math.max(1, (safe.w - SAFE_MARGIN * 2) / PROMPT_PEAK_SCALE),
    maxH: Math.max(1, (safe.h - SAFE_MARGIN * 2) / PROMPT_PEAK_SCALE),
  };
}

/** Does a block of this ink extent, centred on the disc, fit? See the header. */
export function fitsBudget(w: number, h: number, b: PromptBudget): boolean {
  if (w > b.maxW || h > b.maxH) return false;
  return w * w + h * h <= 4 * b.radius * b.radius;
}

/** Ink of one line at one size. `scene.ts` passes `labelInk`; tests pass a face. */
export type MeasureLine = (line: string, size: number) => Ink;

/**
 * Every way this condition may be broken, fewest lines first and relation breaks
 * before operator breaks.
 *
 * The order is load-bearing: `layoutPrompt` keeps the first candidate that
 * reaches the largest size, so a tie is resolved toward one line, and then toward
 * breaking at the `=` rather than mid-expression. That is the reading a person
 * would choose, arrived at by ordering rather than by a scoring function nobody
 * can predict.
 */
export function breakings(text: string): readonly (readonly string[])[] {
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length <= 1) return [[text.trim() === "" ? text : (tokens[0] as string)]];

  // Position 0 is not a break: a first line is not a break, it is a beginning.
  const relations: number[] = [];
  const operators: number[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i] as string;
    if (RELATIONS.includes(t)) relations.push(i);
    else if (OPERATORS.includes(t)) operators.push(i);
  }
  const points = [...relations, ...operators];

  const out: string[][] = [[tokens.join(" ")]];
  const cut = (at: readonly number[]): string[] => {
    const lines: string[] = [];
    let from = 0;
    for (const p of at) {
      lines.push(tokens.slice(from, p).join(" "));
      from = p;
    }
    lines.push(tokens.slice(from).join(" "));
    return lines;
  };
  for (const a of points) out.push(cut([a]));
  for (const a of points) {
    for (const b of points) {
      if (b > a) out.push(cut([a, b].sort((x, y) => x - y)));
    }
  }

  const seen = new Set<string>();
  const unique: string[][] = [];
  for (const lines of out) {
    if (lines.length > MAX_PROMPT_LINES) continue;
    const key = lines.join("\n");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(lines);
  }
  return unique;
}

function blockInk(lines: readonly string[], size: number, measure: MeasureLine): Ink {
  let w = 0;
  let tallest = size * CAP_EM;
  for (const line of lines) {
    const ink = measure(line, size);
    if (ink.w > w) w = ink.w;
    if (ink.h > tallest) tallest = ink.h;
  }
  return { w, h: (lines.length - 1) * size * PROMPT_LINE_EM + tallest };
}

/**
 * The largest whole-pixel size at or below `ideal` at which these lines fit, or
 * 0 when not even the floor does.
 *
 * Whole pixels on purpose: `glyphs.ts` keys its raster cache on the size, and a
 * size that tracks a continuously shrinking arena would rebuild every glyph
 * every frame and still look like it was crawling.
 *
 * Binary search is sound because ink width is an advance plus a constant
 * tracking term and is therefore monotone non-decreasing in size — asserted over
 * the test's faces rather than assumed.
 */
function largestFitting(
  lines: readonly string[],
  ideal: number,
  b: PromptBudget,
  measure: MeasureLine,
): number {
  const fitsAt = (size: number): boolean => {
    const ink = blockInk(lines, size, measure);
    return fitsBudget(ink.w, ink.h, b);
  };
  let hi = Math.max(MIN_PROMPT_PX, Math.floor(ideal));
  if (fitsAt(hi)) return hi;
  let lo = MIN_PROMPT_PX;
  if (!fitsAt(lo)) return 0;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fitsAt(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * The size the condition is drawn at when there is room for it.
 *
 * Unchanged from what shipped, so a short condition on a roomy screen looks
 * exactly as it always did and this whole file is a no-op there. It lives here
 * rather than inline in `scene.ts` for one reason: `prompt.test.ts` asserts the fit
 * at every viewport the fleet has, and a test that re-derives the ideal size from
 * its own copy of `Math.max(56, scale * 0.52)` is a test that keeps passing after
 * the renderer's copy changes.
 */
export function promptIdeal(scale: number): number {
  return Math.max(56, scale * 0.52);
}

/**
 * The whole chain, from a frame to a laid-out condition.
 *
 * `scene.ts` calls exactly this and then draws `block.lines` at `block.offsets`;
 * there is no other path to the water. Everything the fit depends on — the safe
 * box, the unzoomed scale, the live arena radius — is an argument, so the test
 * drives the shipping code rather than a reconstruction of it.
 */
export function promptFit(
  text: string,
  safe: Rect,
  scale: number,
  arenaR: number,
  measure: MeasureLine,
): PromptBlock {
  return layoutPrompt(text, promptIdeal(scale), promptBudget(safe, arenaR * scale), measure);
}

/** Lay the condition out: how it breaks, how big it is, where each line sits. */
export function layoutPrompt(
  text: string,
  ideal: number,
  b: PromptBudget,
  measure: MeasureLine,
): PromptBlock {
  const candidates = breakings(text);
  let bestLines: readonly string[] | null = null;
  let bestSize = 0;
  for (const lines of candidates) {
    const size = largestFitting(lines, ideal, b, measure);
    // Strictly greater, so a tie keeps the earlier candidate: fewer lines, and
    // then the relation break. See `breakings`.
    if (size > bestSize) {
      bestSize = size;
      bestLines = lines;
    }
  }

  const fits = bestLines !== null;
  // Nothing reached the floor. Draw at the floor, broken as far as it breaks —
  // the widest break is the last candidate, which is the most-wrapped one.
  const lines = bestLines ?? (candidates[candidates.length - 1] as readonly string[]);
  const size = fits ? bestSize : MIN_PROMPT_PX;
  const ink = blockInk(lines, size, measure);
  const offsets = lines.map((_, i) => (i - (lines.length - 1) / 2) * size * PROMPT_LINE_EM);
  return { lines, size, w: ink.w, h: ink.h, offsets, fits };
}
