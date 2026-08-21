/**
 * HOW LONG YOU GET TO ANSWER.
 *
 * Two numbers, and both of them are a pure function of the QUESTION and of
 * nothing else — not the tempo, not the difficulty scalar, not how well the run
 * is going, not what bar it is.
 *
 * ## Why this file exists at all
 *
 * `dynawalla/docs/PACING_AUDIT_2026-07.md` found the same defect in seventeen
 * games: a comprehension window derived from a motion constant that is ALSO the
 * escalation knob. Splitbeat had it twice.
 *
 *   - The reading lead was `revealT0 + spb * 4 * (1 + inhaleBars)`, and `spb`
 *     is `60 / bpm`, and `bpm` climbs with the difficulty. `READ_SEC` was added
 *     as a FLOOR under that, which stopped it collapsing but did not make it
 *     monotone: a live run measured 7.35 s, 7.20, 7.05, 6.92, 6.54, 6.42, 6.30,
 *     6.19 — eight consecutive questions, each one HARDER than the last and
 *     each one given LESS time than the last, all of them technically above the
 *     6 s floor. The floor was doing its job and the shape was still wrong.
 *
 *   - The strike window on the three answer tiles came out of `windowsFor`,
 *     which is a function of note SPACING. It happened to sit at the flat
 *     ±205 ms ceiling for every tempo this game reaches, so it was not
 *     misbehaving yet — but it was one bpm constant away from doing so, and
 *     "not currently broken" is not a property you can assert.
 *
 * ## The shape
 *
 * Affine and increasing in `Question.difficulty`, which the contract defines on
 * [0,1]. Increasing is stronger than the requirement — a harder question must
 * never get LESS time — and it is stronger on purpose, because "never less" is
 * satisfied by a constant and a constant is what the pacing audit found
 * everywhere. A child asked to regroup two digits gets meaningfully longer than
 * a child asked a single-digit fact, and nothing about the run can take it back.
 *
 * `READ_FLOOR` is 6 s because `dw.ns.compare.whole-numbers` publishes a p50
 * fluency target of 9 s and the gate's clock is measured from the instant the
 * tiles become strikeable rather than from the reveal, so the reveal-to-strike
 * lead is reading time on top of thinking time. `READ_CEIL` is 9.5 s: at the top
 * of the ladder that is a bar and a half of extra music at every tempo the game
 * plays.
 *
 * ## Delivered exactly, not approximately
 *
 * A gate's tiles land on a bar line, because this is a rhythm game and a drummer
 * can feel a downbeat coming. The naive way to spend a reading budget on a
 * bar-quantised game is to round the budget UP to a whole number of bars, and
 * that reintroduces the tempo: the delivered window becomes
 * `barDur * ceil(plan / barDur)`, which is not monotone in the item because
 * `barDur` moves underneath it.
 *
 * So the quantisation is spent on the OTHER end. The gate bar stays on the grid
 * and the REVEAL is scheduled `readSec` before it — mid-bar if that is where it
 * falls, which is fine because a reveal is a gain ramp and a box of text, not a
 * note. `core.ts` sizes the inhale generously enough that the reveal always
 * lands at or after the reveal bar's own start, and then sets
 * `revealAt = gateTime - plan.readSec` exactly. Delivered IS planned, at every
 * tempo, for every item.
 */

/** Seconds of reading for the easiest possible item. */
export const READ_FLOOR = 6;
/** Seconds of reading for the hardest possible item. */
export const READ_CEIL = 9.5;

/**
 * Half-width of the strike window on an answer tile, in seconds, for the
 * easiest item.
 *
 * Wider than `BASE_WINDOWS.miss` (±205 ms) because a tile is not a groove note:
 * missing it costs an ANSWER, and the child's hand is arriving from a decision
 * rather than from a pulse they were already riding.
 */
export const STRIKE_FLOOR = 0.3;
/** …and for the hardest item. */
export const STRIKE_CEIL = 0.55;

export type AnswerPlan = {
  /** Seconds between the question appearing and its tiles becoming strikeable. */
  readonly readSec: number;
  /** Half-width of the window around the strike instant, in seconds. */
  readonly strikeSec: number;
};

/**
 * The contract puts `Question.difficulty` on [0,1]. A host that ignores that is
 * not a reason to hand a child a negative reading window, so it is clamped, and
 * a host that hands over `NaN` gets the EASIEST plan rather than the hardest —
 * unknown difficulty is not evidence of mastery.
 */
function itemDifficulty(item: { difficulty: number }): number {
  const d = item.difficulty;
  if (!Number.isFinite(d)) return 0;
  return d < 0 ? 0 : d > 1 ? 1 : d;
}

/** The answering plan for one item. Pure; depends on nothing but the item. */
export function answerPlan(item: { difficulty: number }): AnswerPlan {
  const d = itemDifficulty(item);
  return {
    readSec: READ_FLOOR + (READ_CEIL - READ_FLOOR) * d,
    strikeSec: STRIKE_FLOOR + (STRIKE_CEIL - STRIKE_FLOOR) * d,
  };
}
