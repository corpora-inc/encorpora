/** Buildable pads, derived from the grid and the channel. Deterministic. */
import { CELL, GRID } from "./constants.ts";
import type { PathData } from "./path.ts";
import { makeRng } from "../core/rng.ts";

export type Plot = {
  id: number;
  x: number;
  y: number;
  /** cosmetic jitter so 30 identical squares do not read as a spreadsheet */
  rot: number;
  size: number;
  towerId: number; // -1 when empty
  /** how much of the channel this pad can reach with a 215-unit tower — used for the hint pulse */
  value: number;
};

const CLEARANCE = 74;

/**
 * Every other column, so the pads are big enough to be a real decision instead
 * of a spreadsheet. Twenty-odd sockets, each one worth thinking about.
 */
export function buildPlots(path: PathData): Plot[] {
  const rng = makeRng(0xb0a2d);
  const plots: Plot[] = [];
  let id = 0;
  for (let row = 1; row < GRID; row += 2) {
    for (let col = 0; col < GRID; col += 2) {
      const x = (col + 0.5) * CELL + rng.r(-11, 11);
      const y = (row + 0.5) * CELL + rng.r(-9, 9);
      if (path.distanceTo(x, y) < CLEARANCE) continue;

      // how many sampled channel points fall inside a starter tower's reach
      let hits = 0;
      const samples = 220;
      const p = { x: 0, y: 0 };
      for (let k = 0; k < samples; k++) {
        path.at((k / samples) * path.length, p);
        if (Math.hypot(p.x - x, p.y - y) <= 215) hits++;
      }
      plots.push({
        id: id++,
        x,
        y,
        rot: rng.r(-0.035, 0.035),
        size: CELL * rng.r(0.93, 1.0),
        towerId: -1,
        value: hits / samples,
      });
    }
  }
  return plots;
}
