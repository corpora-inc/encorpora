/**
 * `@dynawalla/engine` — the learner model.
 *
 * Pure TypeScript: no IO, no DOM, no clock, no randomness, and no import from the
 * app or from the curriculum. `boundary.test.ts` fails the build if that stops
 * being true (gate EG-1).
 */

export * from "./types.ts";
export * from "./constants.ts";
export * as fixed from "./math/fixed.ts";
export { expNeg, sigmoid, HALF, SIGMOID_DOMAIN } from "./math/logistic.ts";
export * from "./skill.ts";
export * from "./bugs.ts";
export * from "./facts.ts";
export * from "./controller.ts";
export * from "./scheduler.ts";
