/**
 * The M2 real-child residual fixture (`A-02`, `T-03`).
 *
 * **It is empty, and that is a reported state rather than a silent one.**
 *
 * ADAPTIVE_LEARNING.md is explicit about why this matters: the non-circularity
 * argument rests on the misspecified personas, and this fixture is the check that
 * the personas are not all wrong in the same direction. "If it is skipped until
 * there is more content, even that check is gone." So the loader exists, the gate
 * reads it, and with no rows the gate reports **BLOCKED** — never `pass`.
 *
 * It is data as code rather than a JSON file read at run time, because
 * `boundary.test.ts` (gate EG-1) bans filesystem access anywhere under
 * `engine/src`, including here.
 *
 * What it will hold: one row per observed response from the M2 playtest — the
 * engine's predicted `P̂` for the item that was served and whether the child got
 * it right, aggregated into the same bins `reliability()` uses. It is **one
 * child's** data (ADR-0017). It can expose a gross mismatch between predicted and
 * observed difficulty. It cannot calibrate `b()`, and no claim beyond that may be
 * made from it.
 */

import type { Fix } from "../math/fixed.ts";

export type Residual = {
  /** The engine's prediction for the item that was served. */
  readonly predicted: Fix;
  /** The realised rate in that bin. */
  readonly observed: Fix;
  readonly items: number;
};

export const REAL_CHILD_RESIDUALS: readonly Residual[] = [];
