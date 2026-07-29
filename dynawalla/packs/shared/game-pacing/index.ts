/**
 * Shared game pacing: ONE intensity scalar that drives a game's maths
 * difficulty, its speed and its density together, in both directions.
 *
 * `flow`  — the adaptive controller. Falls fast on struggle, climbs slow on
 *           success, smoothed, silent, bounded.
 * `curve` — how a game spends that intensity on its own constants, and how a
 *           continuous intensity picks a discrete rung on a curriculum ladder
 *           without flickering.
 *
 * Pure functions only. No DOM, no rendering, no timers, no module state — the
 * game owns every piece of state and this only ever computes the next value.
 */
export {
  SECOND_GRADE_FLOW,
  observe,
  outcomeScore,
  quickness,
  revealMs,
  revealShown,
  demandFor,
  seedSuccess,
  settle,
  secondsBetween,
  type FlowSpec,
} from "./flow.ts"
export {
  clamp01,
  curved,
  uncurved,
  valueAt,
  countAt,
  rungAt,
  type Curve,
} from "./curve.ts"
