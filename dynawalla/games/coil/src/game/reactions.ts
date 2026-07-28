// What the game does back, and how much of it.
//
// Two invariants from `docs/EXPERIENCE_DESIGN.md`, both asserted in
// `reactions.test.ts` because neither survives being a comment:
//
//   1. **`energy(SLIP) < energy(SEAT)`.** Being wrong must not be the more
//      interesting thing that happens. In this game that is easy to get wrong,
//      because a piece of brass bouncing off the floor is inherently more
//      animated than one seating into a recess — so the slip is deliberately
//      short, dull, low-gain and nearly still, and the seat carries the light.
//   2. **Escalation is on difficulty and repair, never on run length.**
//      `tierFor` takes no streak, no combo and no run counter; its whole input
//      is what the cut cost and whether it closed a course. A test asserts the
//      shape of that input, so adding a streak means changing a test on purpose
//      rather than by accident.

export type Tier = "slip" | "seat" | "engage" | "illuminate"

export type Reaction = {
  readonly budgetMs: number
  readonly particles: number
  readonly peakGain: number
  readonly animatedElements: number
}

export const REACTIONS: Record<Tier, Reaction> = {
  // A lump of metal that did not fit, landing on stone. 260 ms, and over.
  slip: { budgetMs: 260, particles: 9, peakGain: 0.2, animatedElements: 2 },
  // The detent: the piece seats, one brick is laid, one bell.
  seat: { budgetMs: 200, particles: 12, peakGain: 0.42, animatedElements: 3 },
  // A cut that cost a regrouping. The whip runs the length of the coil.
  engage: { budgetMs: 450, particles: 20, peakGain: 0.5, animatedElements: 5 },
  // A course closed. The wall lights, once, for as long as it takes to see.
  illuminate: { budgetMs: 900, particles: 34, peakGain: 0.6, animatedElements: 7 },
}

/** budgetMs × particles × peakGain × animatedElements. The proxy, spelled out. */
export function energy(tier: Tier): number {
  const r = REACTIONS[tier]
  return r.budgetMs * r.particles * r.peakGain * r.animatedElements
}

/**
 * What just happened, and nothing about how long it has been happening.
 *
 * `breaks` is how many links the child cracked open for this cut — the number
 * of regroupings they performed, which is the honest difficulty of the item
 * they just did rather than a count of how many they have done in a row.
 */
export type Moment = {
  readonly exact: boolean
  readonly courseClosed: boolean
  readonly breaks: number
}

export function tierFor(moment: Moment): Tier {
  if (!moment.exact) return "slip"
  if (moment.courseClosed) return "illuminate"
  return moment.breaks > 0 ? "engage" : "seat"
}
