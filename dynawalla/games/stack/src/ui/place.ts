/**
 * Where the chrome is ALLOWED to sit, as numbers — so the placement can be
 * proven at every viewport instead of discovered on a tablet.
 *
 * Two forces decide this file.
 *
 * **The host paints over the game.** It draws an exit control in the top-LEFT
 * 44px corner and a how-to-play control in the top-RIGHT 44px corner, over the
 * pack, plus a 3px progress hairline. MONUMENT shipped its floor count at
 * `left:14px` and its best at `right:14px`, both flush to the top — which is
 * exactly where those two controls now land. The single most important number
 * in the game was going to sit under the exit chevron.
 *
 * The host chrome OVERLAYS rather than reserving a band, and that is
 * deliberate: reserving one cost 12% of a 568px phone and broke a sibling's
 * layout outright. So the sky, the tower and the sparks still bleed to every
 * edge — that is what `viewport-fit=cover` is for. The promise is narrower and
 * absolute: nothing a child must READ or TOUCH lands in those two corners.
 * Here that means the readouts step INWARD, past the corner squares, onto the
 * same row as the host's own controls.
 *
 * **`env()` cannot be read from JavaScript, and inside a pack it cannot be read
 * at all.** A pack runs in an iframe sandboxed `allow-scripts` with no
 * `allow-same-origin`, and `env(safe-area-inset-*)` belongs to the TOP-LEVEL
 * browsing context — so a cross-origin child resolves all four to ZERO. This
 * module used to hand `hud.ts` a `calc(env(...) + Npx)` string, which meant the
 * numeric dialect below was correct about a notch the stylesheet could not see:
 * `place.test.ts` proved the floor count cleared a 59px status bar while the
 * shipped rule put it at 13px. SIEGE shipped the identical split and the founder
 * found it on an Android phone, with the currency painted under the OS clock.
 *
 * So the CSS dialect now reads `var(--mn-safe-*, env(...))`, and the four
 * properties are published onto the HUD root from the host's own measurement by
 * `publishSafeVars`. The `env()` stays as the fallback because it is right in a
 * dev browser tab, where there is no host to publish anything.
 *
 * One source, two readers — a test that re-derived the geometry would prove only
 * that it agreed with itself.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  NO_INSETS,
  publishSafeVars,
  safeInsets,
  type Insets,
  type Rect,
  type StyleTarget,
} from "../../../../packs/shared/game-chrome/index.ts";

/* ── the geometry ───────────────────────────────────────────────────────── */

/** Air between a host control and whatever the game puts beside or under it. */
export const GUTTER = 8;

/** Down from the safe top edge to the top of the host's row of controls. */
export const CHROME_TOP = HOST_PROGRESS_H + HOST_MARGIN;

/** In from a safe side edge to the first column a readout may use. */
export const CHROME_CLEAR = HOST_MARGIN + HOST_CONTROL + GUTTER;

/** The gutter along the bottom, which the host does not contest. */
export const EDGE = 14;
/** The tool row's own gutter, kept as authored. */
export const TOOL_EDGE = 12;

/** Gap between the floor numeral and its label. */
export const FLOOR_GAP = 10;

/** The stone's tap target, and the tool buttons, are square. */
export const TOOL_SIZE = 40;

/* ── type scale ─────────────────────────────────────────────────────────── */

/**
 * A `clamp(min, vmin, max)` type step, in a form both dialects can read.
 * `cssScale` writes the declaration; `scalePx` resolves the same step for a
 * given viewport. They cannot drift because they read the same record.
 */
export type Scale = { readonly min: number; readonly vmin: number; readonly max: number };

export const cssScale = (s: Scale): string => `clamp(${s.min}px,${s.vmin}vmin,${s.max}px)`;

export const scalePx = (s: Scale, w: number, h: number): number =>
  Math.min(s.max, Math.max(s.min, (Math.min(w, h) * s.vmin) / 100));

export const FLOOR_NUM: Scale = { min: 40, vmin: 10.5, max: 84 };
export const LABEL: Scale = { min: 9, vmin: 2.2, max: 12 };
export const BEST_NUM: Scale = { min: 15, vmin: 4, max: 26 };
export const PROMPT: Scale = { min: 21, vmin: 6.6, max: 46 };

/** Letter-spacing of the two uppercase labels, in em, as authored. */
const FLOOR_TRACK = 0.22;
const BEST_TRACK = 0.2;

/** The prompt plate's padding and rule, in em and px, as authored. */
const PROMPT_PAD_Y = 0.42 + 0.5;
const PROMPT_LINE = 1.2;
const PROMPT_PAD_X = 0.72;
const PROMPT_RULE = 3;

/** Half the prompt plate's border box — it is centred on its own `top`. */
export const promptHalf = (w: number, h: number): number => {
  const f = scalePx(PROMPT, w, h);
  return (f * (PROMPT_PAD_Y + PROMPT_LINE) + PROMPT_RULE) / 2;
};
const PROMPT_HALF_EM = (PROMPT_PAD_Y + PROMPT_LINE) / 2;

/**
 * The floor block's height, as a multiple of the numeral.
 *
 * The numeral's line box is `.85em`, and the run-up pulse scales it to 1.16 for
 * 240ms around its own centre. `1` covers the line box, the label's descender
 * and the pulse, and is what the gap below it is measured from.
 */
const FLOOR_BOX = 1;

/**
 * Glyph advance for the heavy tabular face, in em. Measured against the real
 * face it over-estimates slightly, which is the direction a clearance model is
 * allowed to be wrong in.
 */
const ADVANCE = 0.66;

const textW = (chars: number, size: number, track = 0): number => chars * size * (ADVANCE + track);

/** The largest floor a run realistically reaches, in digits. */
export const FLOOR_DIGITS = 3;

/* ── the CSS dialect ────────────────────────────────────────────────────── */

/** The namespace the four published lengths live under. */
export const SAFE_PREFIX = "--mn-safe-";

/**
 * One safe edge plus a gutter, as a length the stylesheet can use.
 *
 * The property first, the `env()` only as the fallback — see the module
 * docblock. Inside the app the fallback is always the wrong answer; in a dev
 * browser tab, where nothing publishes, it is the only one available.
 */
const safe = (side: "top" | "right" | "bottom" | "left", px: number): string =>
  `calc(${cssSafe(side)} + ${px}px)`;

/** Just the safe edge, with no gutter added. */
export const cssSafe = (side: "top" | "right" | "bottom" | "left"): string =>
  `var(${SAFE_PREFIX}${side}, env(safe-area-inset-${side}, 0px))`;

/**
 * Hand the stylesheet the safe area, from the host's measurement.
 *
 * Called at mount and again on every resize: a rotation trades one top inset for
 * two side ones, and iPadOS changes them when a pack is resized in Split View.
 * Idempotent — nothing is written when the numbers have not moved.
 *
 * @returns whether anything changed.
 */
export function applySafeVars(
  root: StyleTarget,
  insets: Insets = safeInsets(),
  previous?: Insets | null,
): boolean {
  return publishSafeVars(root, SAFE_PREFIX, insets, previous);
}

/** The row the host's controls sit on. The readouts join it, beside them. */
export const CSS_ROW_TOP = safe("top", CHROME_TOP);
export const CSS_CLEAR_LEFT = safe("left", CHROME_CLEAR);
export const CSS_CLEAR_RIGHT = safe("right", CHROME_CLEAR);
export const CSS_EDGE_LEFT = safe("left", EDGE);
export const CSS_TOOL_RIGHT = safe("right", TOOL_EDGE);
export const CSS_TOOL_BOTTOM = safe("bottom", TOOL_EDGE);
export const CSS_HINT_BOTTOM = `calc(${cssSafe("bottom")} + 12%)`;

/**
 * The prompt's centre: 18% down, or below the floor readout, whichever is
 * lower.
 *
 * 18% is the authored composition and wins on every phone. It stops winning on
 * a landscape tablet, where `10.5vmin` makes the floor numeral 80px tall and
 * 18% of 768 puts the plate straight through it — and pushing the readout in
 * from the corner moved it toward the plate rather than away. The `max()` is
 * what makes "the plate never touches the readout" true by construction rather
 * than by luck, at every shape.
 */
export const CSS_PROMPT_TOP =
  `max(18%, calc(${safe("top", CHROME_TOP + GUTTER + PROMPT_RULE / 2)}` +
  ` + ${FLOOR_BOX} * ${cssScale(FLOOR_NUM)} + ${PROMPT_HALF_EM} * ${cssScale(PROMPT)}))`;

/* ── the numeric dialect ────────────────────────────────────────────────── */

export type HudRects = {
  /** The floor count. The one number the whole game is about. */
  readonly floor: Rect;
  /** The best-ever floor. */
  readonly best: Rect;
  /** The equation plate. */
  readonly prompt: Rect;
  /** The sound toggle. */
  readonly tools: Rect;
};

/**
 * Every box a child must read or touch, in CSS pixels, for a viewport.
 *
 * The text boxes are modelled from the same type scale and the same offsets the
 * stylesheet is built from; glyph widths are estimated generously. Pass these
 * to `hitsHostChrome` to prove the promise.
 */
export function hudRects(w: number, h: number, insets: Insets = NO_INSETS): HudRects {
  const num = scalePx(FLOOR_NUM, w, h);
  const label = scalePx(LABEL, w, h);
  const best = scalePx(BEST_NUM, w, h);
  const prompt = scalePx(PROMPT, w, h);

  const rowTop = insets.top + CHROME_TOP;

  const floorW = textW(FLOOR_DIGITS, num) + FLOOR_GAP + textW(5, label, FLOOR_TRACK);
  const floorRect: Rect = {
    x: insets.left + CHROME_CLEAR,
    y: rowTop,
    w: floorW,
    h: num * FLOOR_BOX,
  };

  const bestW = Math.max(textW(4, label, BEST_TRACK), textW(FLOOR_DIGITS, best));
  const bestRect: Rect = {
    x: w - insets.right - CHROME_CLEAR - bestW,
    y: rowTop,
    w: bestW,
    h: label * 1.2 + best * 1.2,
  };

  const half = promptHalf(w, h);
  const centre = Math.max(
    0.18 * h,
    insets.top + CHROME_TOP + num * FLOOR_BOX + GUTTER + prompt * PROMPT_HALF_EM + PROMPT_RULE / 2,
  );
  // Long as this game ever asks: "12 + ? = 100" and its kin.
  const promptW = textW(14, prompt) + prompt * PROMPT_PAD_X * 2;
  const promptRect: Rect = {
    x: w / 2 - promptW / 2,
    y: centre - half,
    w: promptW,
    h: half * 2,
  };

  const toolsRect: Rect = {
    x: w - insets.right - TOOL_EDGE - TOOL_SIZE,
    y: h - insets.bottom - TOOL_EDGE - TOOL_SIZE,
    w: TOOL_SIZE,
    h: TOOL_SIZE,
  };

  return { floor: floorRect, best: bestRect, prompt: promptRect, tools: toolsRect };
}
