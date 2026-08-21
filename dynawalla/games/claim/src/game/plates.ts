// The revive gate's three plates — where the child answers.
//
// This is the only surface in CLAIM that produces an answer an exact judge can
// grade (see `Goal.questionId` in `levels.ts` for why a banded cut cannot be
// one), so it is the one place where "the child computed it right and the game
// said wrong" is unforgivable. It lives out here, away from the canvas and the
// DOM, so that claim can be proved rather than played.
//
// Two rules, and they are both about the same thing:
//
//   1. **No two plates share a row or a column.** They used to sit at
//      `gy = h * 0.5` with `gx` at a quarter, a half and three quarters of the
//      width — three labels strung along one line, in a game whose player moves
//      one cell at a time along rows and columns. Driving to the far plate meant
//      driving *through* the near ones, and the first box entered took the
//      answer. A child who computed 4500, saw it on the right-hand plate and
//      drove right was recorded as having answered whatever was in the middle.
//      The centre row was also exactly where the prompt card is drawn.
//
//   2. **Arriving is not answering.** Separation alone only makes a mis-take
//      unlikely — the player still picks their own route. So a plate must be
//      *held*: it fills while you stand on it and empties the instant you leave,
//      and `PLATE_ARM` is longer than the time it takes to cross one at any
//      speed the ladder can reach. Passing over an answer can no longer give it.

export type Plate = {
  gx: number
  gy: number
  label: string
  correct: boolean
  taken: boolean
  /** Entry animation, 0→1. */
  pop: number
  /** Seconds held, 0→`PLATE_ARM`. */
  charge: number
}

/** Half-width of a plate, in cells. Matches what `render.drawPlate` draws. */
export const PLATE_HALF_W = 4.2
/** Half-height of a plate, in cells. */
export const PLATE_HALF_H = 3.4

/**
 * Seconds a plate must be held before it answers.
 *
 * Must stay above the time it takes to drive across one — `railSpeed` is 25
 * cells per second at level one, so a crossing is 8.4/25 = 0.34s. There is a
 * test that walks the whole ladder and holds this to it.
 */
export const PLATE_ARM = 0.55

/**
 * Where the plates sit, as fractions of the arena.
 *
 * Distinct rows and distinct columns, every pair separated by more than a plate,
 * and none of them in the middle band of the screen where the prompt card is.
 * Index order is fixed; which *label* lands on which plate is shuffled by the
 * caller, so there is no learnable "the answer is always the low one".
 */
export const PLATE_SPOTS: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0.18],
  [0.78, 0.62],
  [0.5, 0.86],
]

/** Lay out up to three plates on an arena `gw` x `gh` cells (rail included). */
export function layoutPlates(
  gw: number,
  gh: number,
  labels: ReadonlyArray<{ label: string; correct: boolean }>,
): Plate[] {
  return labels.slice(0, PLATE_SPOTS.length).map((l, i) => {
    const [fx, fy] = PLATE_SPOTS[i] as readonly [number, number]
    return { gx: gw * fx, gy: gh * fy, label: l.label, correct: l.correct, taken: false, pop: 0, charge: 0 }
  })
}

/** Is the player standing on this plate? */
export function onPlate(p: Plate, px: number, py: number): boolean {
  return Math.abs(p.gx - px) < PLATE_HALF_W && Math.abs(p.gy - py) < PLATE_HALF_H
}

/**
 * Advance every plate's hold and return the index of the one just answered, or
 * -1.
 *
 * Leaving a plate empties it outright rather than draining it. A child crossing
 * two plates on the way to a third must not be able to bank two half-holds into
 * an answer they never chose, and "it empties when you step off" is a rule a
 * ten-year-old can see happening.
 */
export function holdPlates(plates: Plate[], px: number, py: number, dt: number): number {
  let answered = -1
  for (let i = 0; i < plates.length; i++) {
    const p = plates[i] as Plate
    if (p.taken) continue
    p.pop = Math.min(1, p.pop + dt * 3.2)
    if (onPlate(p, px, py)) {
      p.charge += dt
      if (p.charge >= PLATE_ARM && answered < 0) answered = i
    } else {
      p.charge = 0
    }
  }
  return answered
}
