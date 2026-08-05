/**
 * Where the readable things go.
 *
 * GUILTY paints one canvas and nothing else, which is why it drops into any
 * host container without dragging styles along — and is also why none of this
 * was ever right. `env(safe-area-inset-*)` is a CSS value; a canvas cannot see
 * it. This game declares `viewport-fit=cover`, which opts the document *into*
 * the notch, the home indicator and the rounded corners, so `fillText` at
 * `y = pad` landed under the status bar on every phone that has one, and the
 * focus bar at `h - 5` sat under the home indicator.
 *
 * On top of that the host floats two 44px controls over every pack: exit at the
 * top-left, how-to-play at the top-right. The lives sat under the first and the
 * score sat under the second, and the equation — the accusation, the one thing
 * a child has to read — is centred and up to 90% of the screen wide, so it ran
 * under both.
 *
 * **The chrome overlays; it does not reserve a band.** Taking a strip off the
 * top of a trench would be absurd — the trench is the game. So everything here
 * moves *sideways* into the channel between the two corners, and nothing moves
 * down except by the height of the notch itself.
 *
 * **What is NOT in here, on purpose:** the water, the light shafts, the
 * plankton, the seabed grid, the gate, the husks, the ship, the bolts, the
 * particles and the vignette. Those are projected through the camera, which is
 * fitted to the whole glass, and they are supposed to bleed under the notch —
 * it is the entire reason `cover` is set. This module is only the things a
 * child must read.
 */

import {
  HOST_CONTROL,
  HOST_MARGIN,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts";
import { EQUATION_Y, VIEW_HALF_H } from "../core/config.ts";

/** Breathing room between a HUD edge and a host control. */
const CHROME_GAP = 8;

export type HudLayout = {
  /**
   * The whole glass, notch and all.
   *
   * Kept beside `safe` so the difference between the two is legible rather than
   * implied: the trench, the gate, the husks and the scrims use THIS, and only
   * the type uses `safe`.
   */
  glass: { w: number; h: number };
  /** The safe rectangle this was built from. */
  safe: Rect;
  /** Common inset, and the type scale everything in the corners is cut from. */
  pad: number;
  /** Type size for the score. */
  scoreSize: number;
  /** The row of ship silhouettes. Left-aligned inside this box. */
  lives: Rect;
  /** The score numeral. RIGHT-aligned to `score.x + score.w`. */
  score: Rect;
  /** `WAVE n`, under the score, right-aligned to the same edge. */
  wave: Rect;
  /**
   * The accusation. The glyph is centred in this box and sized to fit it.
   *
   * Its centre is the world position `EQUATION_Y` projects to, pushed down only
   * as far as the notch requires, so the husks still visibly fan out of it —
   * that fan-out is the whole tutorial and must not come apart.
   */
  equation: Rect;
  /** Baseline for the focus bar, clear of the home indicator. */
  focusY: number;
  /** Half-width the focus bar may grow to, each side of centre. */
  focusHalfW: number;
  /** Centre of anything full-screen: the banner, the title, the game-over. */
  cx: number;
  cy: number;
};

/**
 * One readable line of a full-screen card.
 *
 * `box` is what the line actually occupies on the glass once it has been
 * measured, which is the only thing a layout test can honestly assert. A card
 * that reports its intended size and not its measured box can be asserted to
 * within an inch of its life and still run off a 320px phone.
 */
export type CardLine = {
  text: string;
  /** Type size after fitting — never the nominal size, if the nominal ran wide. */
  size: number;
  /** Baseline centre. Every line is `textAlign = "center"` on `hud.cx`. */
  y: number;
  box: Rect;
};

/** Text width at a given type size, as the canvas in front of the child measures it. */
export type Measure = (text: string, size: number) => number;

/** Below this a line stops being type. The same floor `hud.ts::fitFont` uses. */
const MIN_TYPE = 9;

/** What the ledger's three facts are joined with when they share a row. */
const LEDGER_SEP = "   ·   ";

/** How far apart two stacked ledger rows sit, in units of the card's nominal size. */
const LEDGER_STEP = 0.42;

export type GameOverCopy = {
  headline: string;
  score: string;
  /** BEST, WAVE and BEST RUN — three facts, not one sentence. See below. */
  ledger: readonly string[];
  prompt: string;
};

/**
 * The death screen, laid out and measured.
 *
 * *"the death screen doesn't quite fit."* It did not, and none of its lines was
 * ever measured: `drawGameOver` was the one card in this game that set a font
 * size from the viewport and then called `fillText` on whatever came out.
 * `THE TRENCH TAKES YOU` is twenty characters at `size × 0.62` and the ledger
 * under the score is about forty — on a 320px phone those come out at roughly
 * 355px and 371px of ink, centred, so both ends ran off the glass. The founder's
 * own handset reports 393 CSS px across and clipped both the same way.
 *
 * Every other card in `hud.ts` — the title, the rule, the correction — already
 * went through `fitFont`. This one is now the same, and it lives here rather
 * than there so it can be asserted at real viewports without driving a run to
 * its death first.
 *
 * **The ledger is three facts, not one string, and that is load-bearing.**
 * Shrinking is not always enough: on a narrow safe rectangle the joined line
 * hits the 9px floor and *still* overhangs, and past that floor a smaller size
 * is not a fix, it is a smaller illegible line. So the three facts pack greedily
 * onto as few rows as the width allows **at full size**, and wrap rather than
 * shrink. No new strings: the same three facts, on one row or two.
 *
 * Which way it goes is decided by the shape of the window and not by the device.
 * `size` is driven by the SHORT edge and the ledger is limited by the long one,
 * so every landscape window keeps the single line this card has always had, and
 * every portrait one wraps to two. That is a change on a phone held upright, and
 * it is the intended one: the alternative is a footnote at 10.6px on a 320px
 * screen, which is smaller than anything else this game asks a child to read.
 *
 * The vertical arithmetic is keyed to the NOMINAL `size` rather than to the
 * fitted sizes. A narrow phone shrinks the headline, and if the rows moved with
 * it the whole card would creep upward on exactly the devices where it is
 * already tightest.
 */
export function gameOverLayout(
  hud: HudLayout,
  copy: GameOverCopy,
  measure: Measure,
): { size: number; lines: CardLine[] } {
  const { safe } = hud;
  const size = Math.min(safe.w * 0.16, safe.h * 0.1);
  // The same 0.9 the title and the correction already use. It is not there to
  // look tidy: it keeps a centred line clear of the rounded corners of the
  // glass, which clip before the safe rectangle does.
  const maxW = safe.w * 0.9;

  // Greedy pack of the ledger at its nominal size. A row is only broken when
  // adding the next fact would overhang, so a wide screen gets the single line
  // this card has always had.
  const ledgerSize = size * 0.3;
  const ledgerRows: string[] = [];
  for (const part of copy.ledger) {
    const last = ledgerRows.length - 1;
    const merged = last < 0 ? part : `${ledgerRows[last] as string}${LEDGER_SEP}${part}`;
    if (last >= 0 && measure(merged, ledgerSize) <= maxW) ledgerRows[last] = merged;
    else ledgerRows.push(part);
  }

  const rows: Array<[string, number, number]> = [
    [copy.headline, 0.62, 0],
    [copy.score, 1.1, 1.05],
    ...ledgerRows.map((text, i): [string, number, number] => [
      text,
      0.3,
      1.75 + i * LEDGER_STEP,
    ]),
    [copy.prompt, 0.32, 2.5 + (ledgerRows.length - 1) * LEDGER_STEP],
  ];

  // Where the block sits, then pushed back inside the safe rectangle if a short
  // window would have hung it off an edge. The tallest row above the anchor is
  // the headline; the lowest is the prompt.
  const lastDrop = rows[rows.length - 1] as [string, number, number];
  const above = size * 0.62 * 0.6;
  const below = size * lastDrop[2] + size * lastDrop[1] * 0.6;
  const y0 = Math.max(safe.y + above, Math.min(safe.y + safe.h * 0.38, safe.y + safe.h - below));

  const lines: CardLine[] = rows.map(([text, scale, drop]) => {
    const nominal = size * scale;
    const wide = measure(text, nominal);
    const fitted = wide > maxW && wide > 0 ? Math.max(MIN_TYPE, nominal * (maxW / wide)) : nominal;
    // MEASURED at the fitted size, never clamped to `maxW`. Clamping it here is
    // how a layout assertion goes vacuous: the box would report the budget
    // instead of the ink, "the box is inside the safe area" would be true by
    // construction, and removing the fitting above would not fail a single test.
    // It was written that way first and the mutation caught it.
    const width = measure(text, fitted);
    const y = y0 + size * drop;
    return {
      text,
      size: fitted,
      y,
      box: { x: hud.cx - width / 2, y: y - fitted * 0.6, w: width, h: fitted * 1.2 },
    };
  });

  return { size, lines };
}

export function hudLayout(w: number, h: number, area: Rect): HudLayout {
  const pad = Math.max(14, Math.min(area.w, area.h) * 0.045);
  const scoreSize = Math.max(20, Math.min(area.w, area.h) * 0.052);

  // The channel between the two host controls. On a 320px phone this is 196 of
  // the 320, which is plenty for three ship silhouettes on one side and a score
  // on the other.
  const rail = HOST_MARGIN + HOST_CONTROL + CHROME_GAP;
  const left = area.x + rail;
  const right = area.x + area.w - rail;

  // The corner row. Both boxes are one line tall and sit on the same baseline.
  const rowY = area.y + pad;
  const rowH = Math.max(18, scoreSize);
  const livesW = Math.min(120, (right - left) * 0.42);

  const lives: Rect = { x: left, y: rowY - rowH / 2, w: livesW, h: rowH };
  const score: Rect = {
    x: right - (right - left) * 0.5,
    y: rowY - rowH / 2,
    w: (right - left) * 0.5,
    h: rowH,
  };
  const wave: Rect = {
    x: score.x,
    y: score.y + scoreSize * 0.85,
    w: score.w,
    h: scoreSize * 0.5,
  };

  // The equation, where the camera would put it: `fitCamera` maps the world's
  // half-height onto half the glass, so `EQUATION_Y` lands at this fraction of
  // the viewport. Recomputed rather than hard-coded so a change to the camera's
  // framing moves the type with the husks.
  const eqH = Math.min(h * 0.085, area.h * 0.12) * 1.35;
  const worldCy = (h / 2) * (1 - EQUATION_Y / VIEW_HALF_H);
  // Pushed down only as far as the NOTCH requires — never as far as the host's
  // controls, because the width below already keeps it out of their columns.
  // On a flat screen this does nothing at all and the type stays exactly where
  // the husks are born.
  const eqCy = Math.max(worldCy, area.y + eqH / 2);
  // Centred on the GLASS, not on the safe area, because the husks are born at
  // world x = 0 and `fitCamera` maps that to `w / 2`. iOS reports the notch on
  // one long edge only, so a phone rotated left and a phone rotated right give
  // asymmetric insets — and centring on the safe area would slide the sum ~23px
  // off the point the four shells fan out of. That fan-out is the whole
  // tutorial. So the box keeps the glass centre and gives up WIDTH instead,
  // taking the widest symmetric span that still clears both corners.
  // The floor is 40, not something comfortable: it is a guard against a degenerate
  // box, never a licence to overhang a control. `game.ts` clamps the canvas to at
  // least 320 CSS px and the two insets cannot exceed 47 each, so the channel is
  // always at least 102px and this never binds on anything real.
  const eqHalf = Math.max(
    40,
    Math.min(right - left, (w / 2 - left) * 2, (right - w / 2) * 2) / 2,
  );
  const equation: Rect = {
    x: w / 2 - eqHalf,
    y: eqCy - eqH / 2,
    w: eqHalf * 2,
    h: eqH,
  };

  return {
    glass: { w, h },
    safe: area,
    pad,
    scoreSize,
    lives,
    score,
    wave,
    equation,
    focusY: area.y + area.h - 7,
    focusHalfW: Math.max(20, area.w * 0.5 - 12),
    cx: area.x + area.w / 2,
    cy: area.y + area.h / 2,
  };
}
