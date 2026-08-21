// THE OPENING — what a child who has never played this before walks into.
//
// The founder's report, verbatim, is the specification:
//
// > "Lattice runner is pretty cool but it's too hard and fast for a human ..
// > maybe one number at a time and a slower ramp up from an easier baseline ..
// > first time you enter it could be just one number calmly coming down the
// > lattice. Maybe it even highlights/hints when it is blastable and why. It
// > needs to be a bit more hand-holdy on the first run. slower, easier, more
// > hand-holdy. the way it starts for me now is chaotic and impossible."
//
// ## What it opened with before
//
// Measured, driving the real `Arena` against the stub host at a phone (390×740)
// and a tablet (1180×820), sixteen seeds, at the rung a brand new profile
// actually starts on:
//
//   * **five bodies on the screen at t=0** (mean 5.00, never fewer than four,
//     as many as six) — the answer's primes gathered into husks by `huskify`,
//     plus a mal-rule decoy's primes, plus one to three loose chaff motes;
//   * **every one of them already moving**, at a mean 5.5% of the arena's
//     diagonal a second and as much as 7.6%;
//   * and once the child starts shooting, **a peak of ten and as many as
//     fifteen** inside the first minute, because every shot turns one husk into
//     two bodies.
//
// Four to six numbers, all drifting, all of which the child is expected to read
// and sort into "shoot this one" and "collect that one", on the first screen
// they have ever seen. That is the "chaotic and impossible" in the report, and
// it is not a difficulty setting — it is the whole field arriving at once.
//
// ## The ramp
//
// Six positions, indexed by how many resonators this child has ever opened —
// `game/seen.ts` remembers that across sittings, so a child coming back to their
// fifth resonator does not get walked through the first one again.
//
//   0. **One number.** The answer's whole factorisation gathered into a single
//      husk, no decoy, no chaff, drifting at three tenths of the ordinary pace.
//      One stone, crossing the sheet slowly, with a numeral on it. Shoot it and
//      it becomes two. That is the entire first lesson.
//   1. Still one number, a little quicker.
//   2. Two husks and one chaff mote. Now there is a choice to make.
//   3. Two husks, one chaff mote, and the decoy comes back — the field can hold
//      a wrong answer again, which is what makes the hold a decision.
//   4. Three husks, two chaff motes, nearly full pace. The guidance comes off.
//   5. and after: the game as it was, unchanged.
//
// Every quantity here is **monotone non-decreasing in `step`** and the guidance
// is monotone non-increasing, and `opening.test.ts` asserts both exhaustively
// rather than taking the table on trust. A child is never overtaken by their own
// progress; the field they get is never busier than the one they get next time.
//
// ## What this is NOT
//
// It is not a window, a timer or a deadline. THE LATTICE has never had one and
// this does not add one — nothing here reads a clock, a speed, a streak or an
// accuracy. `openingAt` is a pure function of one integer, and the only thing
// that integer counts is resonators the child *finished*.

import { MAX_HUSK, ascending } from "./factor.ts"

/**
 * Openings after which the game is simply the game.
 *
 * Five, because that is the last index with a hand on it — `openingAt(5)` and
 * everything above it is the steady state. Exported so a test or a rig can say
 * "a child who is past all this" without knowing the table.
 */
export const CALM_OPENINGS = 5

export type Opening = {
  readonly step: number
  /**
   * How many husks the answer's primes may be gathered into.
   *
   * `1` is the founder's one number: the whole factorisation in one stone.
   * `Infinity` hands the job back to `factor.huskify`, which is what the game
   * has always done.
   */
  readonly husks: number
  /**
   * Loose chaff motes on the field. `Infinity` means "as many as the ladder
   * asks for", which is the shipped behaviour and rises with the band.
   */
  readonly chaff: number
  /** Whether one of the host's mal-rule answers is made assemblable. */
  readonly decoy: boolean
  /** The drift band, as a fraction of the arena's ordinary one. */
  readonly drift: number
  /**
   * Whether the field marks which numbers divide what is left. See `live.ts`.
   *
   * While this is on the arena does not climb its own ladder — the guidance
   * says which primes the hold needs, so an opening it helped with is not
   * evidence about arithmetic. Exactly the rule `hint.ts` already applies to a
   * tree that stated the answer, for exactly the same reason.
   */
  readonly guided: boolean
}

const CALM: readonly Omit<Opening, "step">[] = [
  { husks: 1, chaff: 0, decoy: false, drift: 0.3, guided: true },
  { husks: 1, chaff: 0, decoy: false, drift: 0.45, guided: true },
  { husks: 2, chaff: 1, decoy: false, drift: 0.6, guided: true },
  { husks: 2, chaff: 1, decoy: true, drift: 0.75, guided: true },
  { husks: 3, chaff: 2, decoy: true, drift: 0.9, guided: false },
]

const STEADY: Omit<Opening, "step"> = {
  husks: Number.POSITIVE_INFINITY,
  chaff: Number.POSITIVE_INFINITY,
  decoy: true,
  drift: 1,
  guided: false,
}

/**
 * The opening a child who has opened `step` resonators gets. Pure, total, and
 * defined for every number including the ones that are not numbers.
 */
export function openingAt(step: number): Opening {
  const at = Number.isFinite(step) ? Math.max(0, Math.floor(step)) : 0
  const row = at < CALM.length ? (CALM[at] as Omit<Opening, "step">) : STEADY
  return { step: at, ...row }
}

/**
 * Gather primes into at most `husks` composite husks whose product is exactly
 * the product of the primes handed in.
 *
 * Ascending and contiguous, which is what makes the split *seeable*: four twos
 * and a seven gathered into two husks is `8` and `14`, not `56` and `2` — the
 * child watches a balanced tree come apart rather than a stalk. `huskify` does
 * the same job with a generator when the field is allowed to be busy; this one
 * is deterministic, because the calm opening must be the same calm opening.
 *
 * `MAX_HUSK` is respected: a group that would overflow it is cut short and what
 * is left rides as its own husk. The product is conserved in every case, which
 * is the property `opening.test.ts` fuzzes.
 */
export function gather(primes: readonly number[], husks: number): number[] {
  const sorted = ascending(primes.filter((p) => Number.isInteger(p) && p >= 2))
  if (sorted.length === 0) return []
  const cap = Math.max(1, Math.min(Math.floor(Number.isFinite(husks) ? husks : sorted.length), sorted.length))
  const out: number[] = []
  let i = 0
  for (let g = 0; g < cap && i < sorted.length; g++) {
    const want = Math.ceil((sorted.length - i) / (cap - g))
    let value = 1
    let taken = 0
    while (taken < want && i < sorted.length) {
      const p = sorted[i] as number
      if (value * p > MAX_HUSK && taken > 0) break
      value *= p
      i += 1
      taken += 1
    }
    if (value > 1) out.push(value)
  }
  // Only reachable through the `MAX_HUSK` guard above. The product is still
  // exact; the field is simply one husk busier than the plan asked for.
  while (i < sorted.length) out.push(sorted[i++] as number)
  return out
}
