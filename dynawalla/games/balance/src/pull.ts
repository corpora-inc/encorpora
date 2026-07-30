// Getting a board, which is not the same thing as getting a question.
//
// `boardFor` can refuse: a division whose divisor would need seventy crates in
// one dish, a numeral too wide to engrave legibly on this screen, notation the
// curriculum grew last week. A refusal must never reach a child, because a child
// cannot skip a board — the only way out of one is solving it, which is exactly
// how the founder ended up stuck on `88965 ÷ 9` with nowhere to go. So this file
// is the loop that keeps asking, and the promise that it always ends with brass
// on the screen.
//
// It lives outside `Game` because `Game` needs a canvas and a DOM and this needs
// neither. The behaviour that matters here — *a board, every time, from any host,
// at any rung* — is the one thing in the game that must be provable, and a test
// cannot prove it through a constructor that calls `document.createElement`.

import type { DifficultyRequest, Question } from "./contract.ts";
import type { PuzzleSpec } from "./puzzle.ts";
import type { BoardLimits, Refusal } from "./adapter.ts";
import { boardFor, lastResortBoard } from "./adapter.ts";
import { HEADROOM, onTheWire, request, type Pacing } from "./pacing.ts";

/**
 * How hard to try before giving up.
 *
 * Four draws at a rung, then a rung down — `STEP` is a shade under a sixty-sixth
 * of the ladder, which is one rung of the one that ships — so 96 tries walks the
 * whole ladder to the floor and then some. Generous on purpose: a wasted draw
 * costs a prefetched question the host discards, and running out costs a child a
 * screen with nothing on it.
 */
export const TRIES = 96;
export const TRIES_PER_RUNG = 4;
export const STEP = 0.015;

export type Pull = {
  spec: PuzzleSpec;
  /**
   * The host's question, or `null` when nothing it offered could be shown and
   * the board came from `lastResortBoard`. Nothing may be reported against a
   * `null` — there is no question id the host would recognise.
   */
  question: Question | null;
  /** Every refusal on the way, for a harness that wants to count them. */
  refusals: Refusal[];
};

/**
 * A board this game can show, always.
 *
 * Asks at the child's own rung first and only steps down after a few misses.
 * That order matters: the questions this pack cannot show are *scattered*
 * through the ladder rather than stacked at the top of it — ten division rungs
 * sit between ordinate 0.34 and 0.86, interleaved with addition rungs it shows
 * perfectly — so a standing `maxDifficulty` ceiling learned from one refusal
 * (which is the right answer in `polarity`, where the constraint is monotone in
 * difficulty) would delete two thirds of the ladder here. Stepping down is
 * per-board and transient: the caller's `Pacing` is never touched, so a refusal
 * costs the child nothing and does not move where they are standing.
 *
 * The bottom of the curriculum is `0 + 1`, which this game has always been able
 * to show, so the sweep terminates. The last-resort board exists anyway, because
 * "there is no board" and "there is no legal move" are the same failure and
 * neither may ever happen.
 */
export function pull(
  next: (r: DifficultyRequest) => Question,
  pacing: Pacing,
  limits: BoardLimits,
  fallbackIndex = 0,
): Pull {
  const refusals: Refusal[] = [];
  const base = request(pacing);
  let level = pacing.level;
  for (let tries = 0; tries < TRIES; tries++) {
    const q = next({
      ...base,
      difficulty: onTheWire(level),
      maxDifficulty: onTheWire(level + HEADROOM),
    });
    const board = boardFor(q, limits);
    if (board.ok) return { spec: board.spec, question: q, refusals };
    refusals.push(board);
    if ((tries + 1) % TRIES_PER_RUNG === 0) level = Math.max(0, level - STEP);
  }
  console.error(
    `[counterpoise] the host refused ${String(TRIES)} draws between ` +
      `${pacing.level.toFixed(2)} and ${level.toFixed(2)} of the ladder; ` +
      `falling back to a local board so the child still has a move`,
  );
  return { spec: lastResortBoard(fallbackIndex), question: null, refusals };
}
