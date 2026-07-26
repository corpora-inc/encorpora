import { COLS, ROWS } from "./core/rules.ts";

/**
 * Geometry, recomputed on every resize.
 *
 * Portrait and landscape are two designs, not one stretched: portrait puts the
 * instrument band above the well, landscape puts it in rails either side, and
 * in both the well is as large as it can possibly be. The well never scrolls
 * and never clips.
 */

export type Layout = {
  w: number;
  h: number;
  dpr: number;
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
};

export const HEADROOM = 1.85;
/** A squashed landscape window has no height to spare; give it back to the well. */
export const HEADROOM_SHORT = 1.3;

export function computeLayout(w: number, h: number, dpr: number): Layout {
  const landscape = w / h > 1.15;
  const pad = Math.max(10, Math.round(Math.min(w, h) * 0.028));
  const headroom = h < 440 ? HEADROOM_SHORT : HEADROOM;

  let cell: number;
  let bandH = 0;
  let rail = 0;

  if (landscape) {
    rail = Math.max(140, Math.min(280, w * 0.21));
    const availW = w - rail * 2 - pad * 2;
    const availH = h - pad * 2;
    cell = Math.floor(Math.min(availW / COLS, availH / (ROWS + headroom)));
  } else {
    bandH = Math.max(96, Math.min(168, h * 0.17));
    const availW = w - pad * 2;
    const availH = h - bandH - pad * 2;
    cell = Math.floor(Math.min(availW / COLS, availH / (ROWS + headroom)));
  }
  cell = Math.max(18, cell);

  const boardW = cell * COLS;
  const boardH = cell * ROWS;
  const blockH = boardH + cell * headroom;

  const boardX = Math.round((w - boardW) / 2);
  const boardY = landscape
    ? Math.round((h - blockH) / 2 + cell * headroom)
    : Math.round(bandH + (h - bandH - blockH) / 2 + cell * headroom);

  const rim = Math.max(6, Math.round(cell * 0.16));
  const chipSize = Math.max(16, Math.round(cell * 0.52));

  const keyR = landscape
    ? Math.max(34, Math.min(64, rail * 0.3))
    : Math.max(30, Math.min(56, bandH * 0.36));

  const base: Layout = {
    w,
    h,
    dpr,
    landscape,
    pad,
    cell,
    boardX,
    boardY,
    boardW,
    boardH,
    wellX: boardX - rim,
    wellY: boardY - rim,
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
    incomingStep: chipSize * 1.22,
    incomingVertical: landscape,
    chipSize,
    soundX: w - pad - 18,
    soundY: pad + 18,
    soundR: 16,
  };

  if (landscape) {
    const lx = pad + rail * 0.5;
    const rx = w - pad - rail * 0.5;
    base.scoreX = lx;
    base.scoreY = h * 0.34;
    base.scoreAlign = "center";
    base.levelX = lx;
    base.levelY = h * 0.5;
    base.keyX = rx;
    base.keyY = h * 0.36;
    base.incomingX = rx;
    base.incomingY = h * 0.56;
    base.soundX = pad + 22;
    base.soundY = h - pad - 22;
  } else {
    const top = pad + (bandH - pad) * 0.5;
    base.scoreX = pad + 4;
    base.scoreY = top;
    base.scoreAlign = "left";
    base.keyX = w / 2;
    base.keyY = top;
    base.levelX = w - pad - 4;
    base.levelY = top - keyR * 0.5;
    // The next chip is leftmost and the queue fades to the right, so it reads
    // in the direction the eye already travels.
    base.incomingStep = chipSize * 1.22;
    base.incomingX = w - pad - chipSize / 2 - base.incomingStep * 2;
    base.incomingY = top + keyR * 0.52;
    // Portrait has no room beside the well, so the toggle lives in the band's
    // top-left corner where nothing else is drawn.
    base.soundX = pad + 16;
    base.soundY = pad + 16;
  }

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
