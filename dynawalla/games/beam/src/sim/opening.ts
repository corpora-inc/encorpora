// THE OPENING — what a child who has never played this walks into.
//
// The founder's report is the specification, and it is the same report he has
// made repeatedly:
//
// > "Lattice runner is pretty cool but it's too hard and fast for a human ..
// > maybe one number at a time and a slower ramp up from an easier baseline ..
// > first time you enter it could be just one number calmly coming down the
// > lattice .. It needs to be a bit more hand-holdy on the first run. slower,
// > easier, more hand-holdy. the way it starts for me now is chaotic and
// > impossible."
//
// > "LATTICE RUNNER IS TOO FUCKING FAST FOR THE 100TH TIME. NO ONE CAN THINK
// > THAT FAST."
//
// The first of those was answered — **in the wrong pack.** It is quoted at the
// top of `games/lattice/src/game/opening.ts` and the ramp it describes was built
// into THE LATTICE, a different game whose display name differs from this one's
// by one word. This file is that ramp, in the game the report was about. See
// `README.md` for why the pack is being renamed.
//
// ## What it opened with
//
// Driving the real shell, the real loop and the real input handlers on a fresh
// profile, over five seeds, at 768×1024:
//
//   * the CORE arrives at **2.0s** and fractures into **four candidates**, and
//     the director is already holding **two ordinary automata** alive beside
//     them, so the first thing this game ever shows a child is seven numbered
//     hulls, six of which are irrelevant to the sum on the seventh;
//   * a hull crosses the lattice in **10s** and steps sideways every 1.15s;
//   * the next problem is asked **2s** after the last one clears, all sitting;
//   * and the pressure curve is on a **clock** — `elapsed / 90` is 65% of it —
//     so a child who has answered nothing at all is at level 0.65 after ninety
//     seconds: five automata alive, a 1.3s spawn gap, hulls crossing in 7.3s,
//     and the requested item difficulty raised from 2 to 7.
//
// That last line is the defect the fleet has now found seventeen times: an
// escalation knob indexed by elapsed time rather than by anything the child
// demonstrated. Here it does not merely tighten the motion, it raises the
// **arithmetic** — `mount.drawWave` asks for `2 + round(level × 7)`.
//
// ## The ramp
//
// Six positions, indexed by cores this child has read — `sim/learned.ts`
// remembers it across sittings and moves it in **both** directions, so a child
// coming back to their sixth core is not walked through the first one again and
// a child having a hard afternoon is met with a calmer lattice inside two waves.
//
//   0. **One number.** No ordinary automata at all: the only thing on the
//      lattice is the CORE with the problem on its face, crossing at five
//      eighths of the ordinary pace, and it fractures into two candidates. One
//      sum, two answers to choose between, and nothing else moving.
//   1. The same, a little quicker, and the next problem comes a little sooner.
//   2. One ordinary automaton joins, and a third candidate. Now there is
//      something to do besides the sum.
//   3. Two automata, and the pressure curve is allowed off its floor.
//   4. Three automata, four candidates, nearly the full curve.
//   5. and after: the game as it shipped, unchanged, in every particular.
//
// Every quantity is **monotone** in `step` — busier, faster and harder as it
// rises, and never the other way — and `opening.test.ts` asserts it exhaustively
// over the whole table rather than taking it on trust.
//
// ## What this is NOT
//
// It is not a comprehension window and it does not touch one. The answering
// window is `sim/window.ts`, is a pure function of the item, and cannot see this
// module, that module, the director or a clock. `descentScale` below moves the
// ORDINARY stream and the CORE's approach — the motion, which is the excitement
// — and a candidate's fall is computed from `windowSeconds` at fracture time and
// is not scaled by anything in here. Speed is rewarded and never enforced.

/** Cores read after which the game is simply the game. */
export const CALM_CORES = 5

export type Opening = {
  readonly step: number
  /**
   * The most ordinary automata the director may hold alive.
   *
   * `0` is the founder's one number: nothing on the lattice but the problem.
   * `Infinity` hands the job back to the pressure curve, which is what the game
   * has always done.
   */
  readonly ordinaries: number
  /** The most candidates a fracture may throw out. Never below two — a choice. */
  readonly candidates: number
  /**
   * Multiplies `descentSeconds`, so a bigger number is a SLOWER crossing.
   *
   * Applied to the ordinary stream and to the core's approach. Never to a
   * candidate's fall, which is the child's thinking time and belongs to the
   * item.
   */
  readonly descentScale: number
  /** Seconds of quiet lattice between one wave clearing and the next arriving. */
  readonly coreGapSeconds: number
  /**
   * The most of the pressure curve this step may reach, 0..1.
   *
   * This is the cap on the clock. `Director.pressure()` still computes
   * `elapsed/90 × 0.65 + kills/60 × 0.45` exactly as it shipped; the ramp only
   * says how much of it a child at this step is allowed to be handed. At the top
   * step the cap is 1 and the curve is untouched.
   */
  readonly ceiling: number
}

const CALM: readonly Omit<Opening, "step">[] = [
  { ordinaries: 0, candidates: 2, descentScale: 1.6, coreGapSeconds: 3.5, ceiling: 0 },
  { ordinaries: 0, candidates: 2, descentScale: 1.45, coreGapSeconds: 3.1, ceiling: 0 },
  { ordinaries: 1, candidates: 3, descentScale: 1.3, coreGapSeconds: 2.8, ceiling: 0 },
  { ordinaries: 2, candidates: 3, descentScale: 1.2, coreGapSeconds: 2.5, ceiling: 0.25 },
  { ordinaries: 3, candidates: 4, descentScale: 1.1, coreGapSeconds: 2.2, ceiling: 0.6 },
]

/**
 * The steady state, and it is the shipped game to the digit.
 *
 * `ordinaries: Infinity` gives the pressure curve's own `floorCount` back;
 * `candidates: 4` is `core.MAX_CANDIDATES`; `descentScale: 1` is no scaling;
 * `coreGapSeconds: 2` is the constant `Director.wantsCore` shipped with; and
 * `ceiling: 1` is the whole curve. Nothing is lost at the top of the ramp, which
 * is the property `opening.test.ts` pins against the constants themselves.
 */
const STEADY: Omit<Opening, "step"> = {
  ordinaries: Number.POSITIVE_INFINITY,
  candidates: 4,
  descentScale: 1,
  coreGapSeconds: 2,
  ceiling: 1,
}

/**
 * The opening a child who has read `step` cores gets. Pure, total, and defined
 * for every number including the ones that are not numbers.
 */
export function openingAt(step: number): Opening {
  const at = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : 0
  const row = at < CALM.length ? (CALM[at] as Omit<Opening, "step">) : STEADY
  return { step: at, ...row }
}

/** The steady state, by name, for a test or a rig that wants "past all this". */
export const STEADY_OPENING: Opening = { step: CALM_CORES, ...STEADY }
