// The rack: four pillars of counterweights, one per decimal place, each with a
// face that hangs weight on and a face that takes it off.
//
// This is the whole input vocabulary of the game. There is no keypad and no
// numeral entry: your pan's load is moved by striking a place, which is why the
// shortest way to any load is its **balanced place-value decomposition**. The
// mathematics is not decoration on top of the controls — it *is* the control
// scheme, and `planStrikes` below is simultaneously the optimal player and the
// definition of what the child is being asked to do.
//
// Everything here is integer. A load, a delta and a strike count are counts of
// whole units; nothing in this file produces or compares a float.

/** Decimal places, heaviest first — the order the pillars stand in. */
export const PLACES = [1000, 100, 10, 1] as const

export type Place = (typeof PLACES)[number]

/** Which way a face moves the pan. */
export type Direction = 1 | -1

export type Strike = {
  readonly place: Place
  readonly dir: Direction
}

/** How far one strike on this face moves the load. Always exact. */
export function strikeValue(strike: Strike): number {
  return strike.place * strike.dir
}

export function applyStrike(load: number, strike: Strike): number {
  return load + strikeValue(strike)
}

export function applyAll(load: number, strikes: readonly Strike[]): number {
  let out = load
  for (const strike of strikes) out = applyStrike(out, strike)
  return out
}

/**
 * The shortest sequence of strikes that moves a pan by exactly `delta`.
 *
 * The trick a child works out for themselves, and the reason the rack has a
 * take-off face at all: **eight is not eight ones, it is ten less two**. Going
 * from 613 to 621 the naive path is eight strikes on the ones pillar; the short
 * path is one on the tens and two off the ones. That is balanced base-ten
 * notation — digits in −5..5 — and it is the game's core insight, discoverable
 * from the rack without anyone explaining it.
 *
 * The thousands pillar is the top of the rack, so it absorbs whatever is left
 * after the lower three places are balanced; its digit may exceed 5 and there is
 * nothing above it to borrow from.
 *
 * Returned heaviest-first, which is also the order a player naturally strikes:
 * get the magnitude right, then trim.
 */
export function planStrikes(delta: number): Strike[] {
  if (!Number.isInteger(delta)) throw new Error("planStrikes: delta must be an integer")
  const digits = new Map<Place, number>()

  let rest = delta
  // Units, tens, hundreds: take each place to its nearest multiple, carrying the
  // remainder up. `rest` stays an exact integer at every step because every
  // subtraction is of a multiple of the place.
  for (const place of [1, 10, 100] as const) {
    const within = rest % (place * 10)
    // `%` in JS keeps the sign of the dividend, so this is already signed.
    let digit = within / place
    // `within` is a multiple of `place` by construction, so this is exact.
    if (digit > 5) digit -= 10
    else if (digit < -5) digit += 10
    digits.set(place, digit)
    rest -= digit * place
  }
  digits.set(1000, rest / 1000)

  const out: Strike[] = []
  for (const place of PLACES) {
    const digit = digits.get(place) ?? 0
    const dir: Direction = digit >= 0 ? 1 : -1
    for (let i = 0; i < Math.abs(digit); i++) out.push({ place, dir })
  }
  return out
}

/** How many strikes the shortest path to `delta` costs. */
export function strikesFor(delta: number): number {
  return planStrikes(delta).length
}

/** Every face on the rack, in reading order: a whole rack of eight. */
export const FACES: readonly Strike[] = PLACES.flatMap((place) => [
  { place, dir: 1 as Direction },
  { place, dir: -1 as Direction },
])

/**
 * A struck plate has to swing back before it can be struck again.
 *
 * Short — this is not a balance mechanic, it is what stops one press being read
 * as two on a touchscreen that fires a pointer and a click. The thing that makes
 * mashing lose lives in `strain.ts`.
 */
export const PILLAR_COOLDOWN_MS = 110
