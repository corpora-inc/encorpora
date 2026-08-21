import { chromeRects, HOST_CONTROL, HOST_MARGIN, type Rect } from "../../../packs/shared/game-chrome/index.ts";
import { COLS, ROWS } from "./core/rules.ts";

/**
 * Geometry, recomputed on every resize.
 *
 * Portrait and landscape are two designs, not one stretched: portrait puts the
 * instrument band above the well, landscape puts it in rails either side, and
 * in both the well is as large as it can possibly be. The well never scrolls
 * and never clips.
 *
 * Two things outside this file own where it may draw.
 *
 * **The safe area.** The pack declares `viewport-fit=cover`, which opts the
 * document *into* the notch, the home indicator and the rounded corners. A DOM
 * HUD claws that back with `env(safe-area-inset-*)`; this HUD is painted on a
 * canvas, where `env()` does not exist, so it has to be handed the rectangle as
 * numbers. That is `area`.
 *
 * **The host's two corners.** The host paints an exit chevron top-left and the
 * how-to-play button top-right, 44px each, *over* the pack. They are not a
 * reserved band — reserving one costs a twelfth of a small phone's height — so
 * the promise this layout keeps is narrower: nothing a child must read or touch
 * lands inside those two squares. The plasma, the well walls and the sparks
 * still bleed to the edges, which is the point of `cover`.
 */

/* --------------------------------- the stage ------------------------------- */

/**
 * Just enough of an element for `makeStage`: the inline style it writes.
 *
 * Structural rather than `HTMLElement` so a test can hand it an object literal
 * and read back exactly what was written, with no cast and no DOM.
 */
export type StageEl = {
  style: { position: string };
};

/**
 * Take the host's element over as FUSE's stage.
 *
 * The canvas is `position: absolute; inset: 0`, so the stage is the only node in
 * the tree with a size of its own — and it is the host *document* that decides
 * what that size is. This function's whole job is to not take that away.
 *
 * **What it replaces shipped a black screen in a sibling game.** The line was
 *
 *     el.style.position = el.style.position || "relative";
 *
 * and `el.style.position` reads the *inline* declaration, which is empty for an
 * element positioned from a stylesheet. `pack.html` says
 * `#root { position: fixed; inset: 0 }`, so the fallback always fired and wrote
 * an inline `relative` that won the cascade — taking the `inset: 0` with it,
 * because insets do nothing to a relatively positioned box. The stage fell back
 * to `height: auto` with nothing but an absolutely positioned canvas inside it.
 * Measured in a framed pack before this fix: `#root` **820x0**.
 *
 * `games/runner` shipped exactly this to two app stores. FUSE did not, and it is
 * worth saying why it did not, because neither reason was a decision:
 *
 *   * it never writes `overflow: hidden` on the stage, so the canvas paints
 *     *outside* the collapsed box rather than being clipped to nothing;
 *   * `resize()` sized that canvas with `el.clientHeight || window.innerHeight`,
 *     and the `||` swallowed the zero.
 *
 * Two accidents, either of which an ordinary edit removes. So: branch on the
 * *computed* position, never the inline one, and write one only when nobody has
 * positioned the element at all.
 *
 * Invisible in `npm run dev` for the same reason it was there: `index.html`
 * gives `#root` a position too, and the dev harness is full-size either way.
 * Only the entry a child runs collapses.
 */
export function makeStage(el: StageEl, computedPosition: string): void {
  if (computedPosition === "static") el.style.position = "relative";
}

export type Layout = {
  w: number;
  h: number;
  dpr: number;
  /** the safe rectangle everything readable was laid out inside */
  area: Rect;
  landscape: boolean;
  pad: number;
  cell: number;
  /** top-left of grid cell (0,0) */
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  /** the rim box drawn around the grid */
  wellX: number;
  wellY: number;
  wellW: number;
  wellH: number;
  /** centre y of the held chip, above the well */
  headY: number;
  /** instrument anchors */
  scoreX: number;
  scoreY: number;
  scoreAlign: "left" | "center";
  keyX: number;
  keyY: number;
  keyR: number;
  levelX: number;
  levelY: number;
  incomingX: number;
  incomingY: number;
  incomingStep: number;
  incomingVertical: boolean;
  chipSize: number;
  soundX: number;
  soundY: number;
  soundR: number;
  /** type sizes, here rather than in the renderer so the boxes below are honest */
  scoreSize: number;
  bestSize: number;
  levelSize: number;
  /**
   * Bounding boxes of everything a child reads or touches.
   *
   * The renderer draws from the anchors above and these are computed from the
   * same anchors, so a test that asserts on them is asserting on what is
   * actually on the glass — which is the only kind of assertion worth having
   * about the notch.
   */
  scoreBox: Rect;
  levelBox: Rect;
  reactorBox: Rect;
  incomingBox: Rect;
  soundBox: Rect;
};

export const HEADROOM = 1.85;
/** A squashed landscape window has no height to spare; give it back to the well. */
export const HEADROOM_SHORT = 1.3;

/** Five digits of score, as a multiple of the score type size. Deliberately generous. */
const SCORE_DIGITS = 3.1;
/** Clear air left between a moved instrument and the corner it moved out of. */
const CHROME_GAP = 4;
/** How far the reactor's octagon reaches past `keyR`. */
const REACTOR_EXTENT = 1.62;
/** The sound toggle's touch target is bigger than its outline; `input.ts` adds 10. */
const SOUND_TOUCH = 10;

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * How far `box` must move DOWN to sit clear of the host's corner squares.
 *
 * Down, never sideways: the score belongs on the left and the level belongs on
 * the right, and a game that slides its readouts toward the middle to dodge a
 * button ends up with everything piled in the centre. A box that already clears
 * them — including one entirely above them, like the reactor's halo bleeding off
 * the top edge — is not moved at all.
 */
function clearOfChrome(box: Rect, corners: readonly Rect[]): number {
  let dy = 0;
  for (const c of corners) {
    if (!overlaps({ ...box, y: box.y + dy }, c)) continue;
    dy = Math.max(dy, c.y + c.h + CHROME_GAP - box.y);
  }
  return dy;
}

const scoreRect = (
  x: number,
  y: number,
  align: "left" | "center",
  scoreSize: number,
  bestSize: number,
): Rect => {
  const w = scoreSize * SCORE_DIGITS;
  // The chain readout rides above the numerals and BEST sits under them; both
  // are part of what has to stay legible, so both are part of the box.
  const top = y - scoreSize * 0.62 - scoreSize * 0.19;
  const bottom = y + scoreSize * 0.62 + bestSize * 0.75;
  return { x: align === "left" ? x : x - w / 2, y: top, w, h: bottom - top };
};

const levelRect = (x: number, y: number, landscape: boolean, size: number): Rect => ({
  // Portrait draws "LV 7" ending at `levelX`; landscape centres it on the rail.
  x: landscape ? x - size * 2.5 : x - size * 4,
  y: y - size * 0.75,
  w: landscape ? size * 5 : size * 4,
  h: size * 1.5,
});

const reactorRect = (x: number, y: number, r: number): Rect => ({
  x: x - r * REACTOR_EXTENT,
  y: y - r * REACTOR_EXTENT,
  w: r * REACTOR_EXTENT * 2,
  h: r * REACTOR_EXTENT * 2,
});

const incomingRect = (x: number, y: number, step: number, size: number, vertical: boolean): Rect => ({
  x: x - size / 2,
  y: y - size / 2,
  w: vertical ? size : step * 2 + size,
  h: vertical ? step * 2 + size : size,
});

const soundRect = (x: number, y: number, r: number): Rect => {
  const t = r + SOUND_TOUCH;
  return { x: x - t, y: y - t, w: t * 2, h: t * 2 };
};

/**
 * `area` is the safe rectangle — `safeRect(w, h)` from
 * `packs/shared/game-chrome`. Everything a child reads or touches is laid out
 * inside it; the background and the particles still use `w`/`h` and bleed.
 *
 * It is REQUIRED, deliberately. Optional, a caller that forgets it compiles and
 * quietly draws the score under the notch, and the only way to find out is on a
 * notched device with the game in your hand.
 */
export function computeLayout(w: number, h: number, dpr: number, area: Rect): Layout {
  const aw = Math.max(1, area.w);
  const ah = Math.max(1, area.h);
  const landscape = aw / ah > 1.15;
  const pad = Math.max(10, Math.round(Math.min(aw, ah) * 0.028));
  const headroom = ah < 440 ? HEADROOM_SHORT : HEADROOM;

  const corners = chromeRects(w, {
    top: area.y,
    left: area.x,
    right: Math.max(0, w - area.x - aw),
    bottom: Math.max(0, h - area.y - ah),
  });
  const cornerBottom = (corners[0] as Rect).y + HOST_CONTROL;

  let cell: number;
  let bandH = 0;
  let rail = 0;

  if (landscape) {
    rail = Math.max(140, Math.min(280, aw * 0.21));
    const availW = aw - rail * 2 - pad * 2;
    const availH = ah - pad * 2;
    cell = Math.floor(Math.min(availW / COLS, availH / (ROWS + headroom)));
  } else {
    bandH = Math.max(96, Math.min(168, ah * 0.17));
    const availW = aw - pad * 2;
    const availH = ah - bandH - pad * 2;
    cell = Math.floor(Math.min(availW / COLS, availH / (ROWS + headroom)));
  }
  cell = Math.max(18, cell);

  const boardW = cell * COLS;
  const boardH = cell * ROWS;
  const blockH = boardH + cell * headroom;

  const boardX = area.x + Math.round((aw - boardW) / 2);
  const boardY = landscape
    ? area.y + Math.round((ah - blockH) / 2 + cell * headroom)
    : area.y + Math.round(bandH + (ah - bandH - blockH) / 2 + cell * headroom);

  const rim = Math.max(6, Math.round(cell * 0.16));
  const chipSize = Math.max(16, Math.round(cell * 0.52));
  const incomingStep = chipSize * 1.22;
  /** the three incoming chips, end to end */
  const stripSpan = incomingStep * 2 + chipSize;

  let keyR = landscape
    ? Math.max(34, Math.min(64, rail * 0.3))
    : Math.max(30, Math.min(56, bandH * 0.36));
  if (landscape) {
    // The right rail stacks the reactor above the next-chip strip, and in a
    // short window both have to fit between the how-to-play button and the
    // bottom of the safe area. Shrink the reactor rather than let the strip walk
    // off the screen: a smaller KEY is legible, a KEY under the gesture bar is
    // not.
    const room = area.y + ah - CHROME_GAP - (cornerBottom + CHROME_GAP) - stripSpan - 8;
    keyR = Math.max(34, Math.min(keyR, room / (REACTOR_EXTENT * 2)));
  } else {
    // Portrait keeps the reactor dead centre, so instead of moving it down onto
    // the well when it grows wide enough to touch a corner, it is allowed to be
    // a little smaller. A smaller KEY is a much cheaper loss than a covered one.
    const room = (aw / 2 - HOST_MARGIN - HOST_CONTROL - CHROME_GAP) / REACTOR_EXTENT;
    keyR = Math.max(22, Math.min(keyR, room));
  }

  const scoreSize = Math.max(24, Math.min(58, cell * 0.86));
  const bestSize = Math.max(10, Math.min(16, cell * 0.26));
  const levelSize = Math.max(14, Math.min(26, cell * 0.42));

  const wellY = boardY - rim;
  const soundR = 16;

  const base: Layout = {
    w,
    h,
    dpr,
    area,
    landscape,
    pad,
    cell,
    boardX,
    boardY,
    boardW,
    boardH,
    wellX: boardX - rim,
    wellY,
    wellW: boardW + rim * 2,
    wellH: boardH + rim * 2,
    headY: boardY - cell * (headroom * 0.58),
    scoreX: 0,
    scoreY: 0,
    scoreAlign: "left",
    keyX: 0,
    keyY: 0,
    keyR,
    levelX: 0,
    levelY: 0,
    incomingX: 0,
    incomingY: 0,
    incomingStep,
    incomingVertical: landscape,
    chipSize,
    soundX: 0,
    soundY: 0,
    soundR,
    scoreSize,
    bestSize,
    levelSize,
    scoreBox: { x: 0, y: 0, w: 0, h: 0 },
    levelBox: { x: 0, y: 0, w: 0, h: 0 },
    reactorBox: { x: 0, y: 0, w: 0, h: 0 },
    incomingBox: { x: 0, y: 0, w: 0, h: 0 },
    soundBox: { x: 0, y: 0, w: 0, h: 0 },
  };

  if (landscape) {
    const lx = area.x + pad + rail * 0.5;
    const rx = area.x + aw - pad - rail * 0.5;
    base.scoreX = lx;
    base.scoreY = area.y + ah * 0.34;
    base.scoreAlign = "center";
    base.levelX = lx;
    base.levelY = area.y + ah * 0.5;
    base.keyX = rx;
    base.keyY = area.y + ah * 0.36;
    base.incomingX = rx;
    base.incomingY = area.y + ah * 0.56;
    base.soundX = area.x + pad + 22;
    base.soundY = area.y + ah - pad - 22;

    // A short landscape window pushes the rails up under the corners; the rails
    // have the room to give, so each stack slides down until it is clear.
    base.scoreY += clearOfChrome(
      scoreRect(base.scoreX, base.scoreY, "center", scoreSize, bestSize),
      corners,
    );
    base.levelY += clearOfChrome(levelRect(base.levelX, base.levelY, true, levelSize), corners);
    base.keyY += clearOfChrome(reactorRect(base.keyX, base.keyY, keyR), corners);
    // The incoming strip hangs off the reactor, so it follows it down rather
    // than being overrun by it — but never past the bottom of the safe area,
    // where a phone's gesture bar is. The reactor was already shrunk above so
    // that both fit; this is the backstop for a window too short even for that.
    base.incomingY = Math.max(
      base.incomingY,
      base.keyY + base.keyR * REACTOR_EXTENT + chipSize / 2 + 8,
    );
    base.incomingY = Math.min(
      base.incomingY,
      area.y + ah - CHROME_GAP - stripSpan + chipSize / 2,
    );
  } else {
    const top = area.y + pad + (bandH - pad) * 0.5;
    base.scoreX = area.x + pad + 4;
    base.scoreY = top;
    base.scoreAlign = "left";
    base.keyX = area.x + aw / 2;
    base.keyY = top;
    base.levelX = area.x + aw - pad - 4;
    base.levelY = top - keyR * 0.5;
    // The next chip is leftmost and the queue fades to the right, so it reads
    // in the direction the eye already travels.
    base.incomingX = area.x + aw - pad - chipSize / 2 - base.incomingStep * 2;
    base.incomingY = base.levelY + keyR * 1.02;

    // The exit chevron owns the top-left square, so the score — the biggest,
    // most-read thing in the band — starts under it. The band is deep enough
    // to absorb that on every phone; where it is not, the score spills into the
    // empty air above the well, which is the one place nothing else is drawn.
    base.scoreY += clearOfChrome(
      scoreRect(base.scoreX, base.scoreY, "left", scoreSize, bestSize),
      corners,
    );
    // Same on the right, under the how-to-play button. The incoming strip keeps
    // its distance from the level readout.
    const levelShift = clearOfChrome(levelRect(base.levelX, base.levelY, false, levelSize), corners);
    base.levelY += levelShift;
    base.incomingY += levelShift;
    base.incomingY += clearOfChrome(
      incomingRect(base.incomingX, base.incomingY, base.incomingStep, chipSize, false),
      corners,
    );

    // Portrait has no rail and no room under the well, so the mute toggle goes
    // at the foot of the left column, under the score — never in the corner the
    // host's exit chevron is already sitting in, which is exactly where it was.
    const score = scoreRect(base.scoreX, base.scoreY, "left", scoreSize, bestSize);
    const scoreBottom = score.y + score.h;
    const touch = soundR + SOUND_TOUCH;
    base.soundX = area.x + pad + soundR + 2;
    base.soundY = Math.max(
      cornerBottom + CHROME_GAP + touch,
      Math.min(scoreBottom + SOUND_TOUCH + soundR, wellY - touch - 6),
    );
  }

  base.scoreBox = scoreRect(base.scoreX, base.scoreY, base.scoreAlign, scoreSize, bestSize);
  base.levelBox = levelRect(base.levelX, base.levelY, landscape, levelSize);
  base.reactorBox = reactorRect(base.keyX, base.keyY, base.keyR);
  base.incomingBox = incomingRect(
    base.incomingX,
    base.incomingY,
    base.incomingStep,
    chipSize,
    landscape,
  );
  base.soundBox = soundRect(base.soundX, base.soundY, soundR);

  return base;
}

/** grid cell -> screen centre */
export function cellCenter(l: Layout, r: number, c: number): { x: number; y: number } {
  return { x: l.boardX + (c + 0.5) * l.cell, y: l.boardY + (r + 0.5) * l.cell };
}

/** screen x -> column, clamped */
export function colAt(l: Layout, x: number): number {
  const c = Math.floor((x - l.boardX) / l.cell);
  return Math.max(0, Math.min(COLS - 1, c));
}
