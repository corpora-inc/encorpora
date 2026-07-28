// The lattice — and with it, the whole of this game's mathematics.
//
// A beam is a whole number. An automaton carries a whole number. The single
// rule the entire game is built on lives in `resonates`:
//
//     a pulse fired up beam `b` destroys an automaton carrying `v`
//     **if and only if** b divides v.
//
// Nothing else in this package is allowed to decide whether a kill lands. The
// renderer asks, the audio asks, the scorer asks, and the tests assert the
// biconditional directly.
//
// The second idea here is `phaseOffset`, which is what makes division audible.
// `v / b` has a fractional part; that fraction is a **phase**. Two waveforms
// separated by that phase beat against each other, and they beat at zero — they
// fuse into one pure tone — exactly when the fraction is zero, which is exactly
// when b divides v. The ear is not being told the answer; it is being handed
// the remainder as a physical quantity. And because a phase is circular, 83 and
// 85 both read as "one away from a multiple of 12" — which is true, and is the
// near-miss a child most needs to feel.

/** The smallest number a beam may be tuned to. A beam of 1 divides everything. */
export const MIN_BEAM = 2
/**
 * The largest number a beam may be tuned to. Twelve is not arbitrary: it is the
 * top of the divisibility facts this product's grade band actually learns, and
 * a two-digit label still reads at the foot of a beam on a 320px screen.
 */
export const MAX_BEAM = 12

/** Every b in [MIN_BEAM, MAX_BEAM] that divides `n`, ascending. */
export function beamDivisors(n: number): number[] {
  const out: number[] = []
  if (!Number.isInteger(n) || n <= 0) return out
  for (let b = MIN_BEAM; b <= MAX_BEAM; b++) if (n % b === 0) out.push(b)
  return out
}

/**
 * THE KILL RULE. One expression, one place, quoted by every other module.
 *
 * Guarded rather than trusting: a NaN value from a malformed item must read as
 * "no resonance" and cost the child nothing, not throw inside the frame loop.
 */
export function resonates(beam: number, value: number): boolean {
  if (!Number.isInteger(beam) || !Number.isInteger(value)) return false
  if (beam < MIN_BEAM || value <= 0) return false
  return value % beam === 0
}

/**
 * The phase gap between a beam's waveform and an automaton's, in turns, signed,
 * in (−0.5, 0.5].
 *
 * Zero **exactly** when the beam divides the value — that identity is the
 * contract between the sound, the picture and the kill rule, and it is asserted
 * as a biconditional in the tests.
 */
export function phaseOffset(beam: number, value: number): number {
  if (!Number.isInteger(beam) || !Number.isInteger(value) || beam < MIN_BEAM) return 0.5
  const p = (((value % beam) + beam) % beam) / beam
  return p > 0.5 ? p - 1 : p
}

/**
 * How hard this value is on this lattice: the number of beams that divide it.
 * A value with one valid beam is a precision intercept; a value with four is a
 * gift. The scorer pays for the former, the director escalates toward it.
 */
export function validBeamCount(beams: readonly number[], value: number): number {
  let n = 0
  for (const b of beams) if (resonates(b, value)) n++
  return n
}

/**
 * Tune a lattice of `count` beams so that every value in `required` is killable
 * on it.
 *
 * The forced picks come first — the smallest beam-range divisor of each
 * required value — and the rest of the lattice is filled with distinct labels
 * that are *not equal to any required value*. That last clause closes a real
 * leak: a beam labelled 8 sitting under an automaton carrying 8 lets a child
 * match two glyphs instead of dividing.
 */
export function tuneLattice(
  required: readonly number[],
  count: number,
  rand: () => number,
): number[] {
  const chosen = new Set<number>()
  const banned = new Set<number>(required)

  for (const v of required) {
    if (chosen.size >= count) break
    const divisors = beamDivisors(v)
    if (divisors.some((b) => chosen.has(b))) continue
    // The ban is a preference; killability is the requirement. A value whose
    // only divisor in range is itself — a small prime — gets that beam anyway,
    // because an odd-looking label is a far smaller problem than an automaton
    // nothing on the board can touch. `usableCoreValue` keeps that case away
    // from the curriculum path, where the leak would matter.
    const d = divisors.find((b) => !banned.has(b)) ?? divisors[0]
    if (d !== undefined) chosen.add(d)
  }

  // Fill. Shuffled by rejection over a shrinking candidate list so the lattice
  // is different every wave and the child cannot memorise a fixed board.
  const pool: number[] = []
  for (let b = MIN_BEAM; b <= MAX_BEAM; b++) if (!chosen.has(b) && !banned.has(b)) pool.push(b)
  while (chosen.size < count && pool.length > 0) {
    const i = Math.min(pool.length - 1, Math.floor(rand() * pool.length))
    chosen.add(pool[i] as number)
    pool.splice(i, 1)
  }
  // Only reachable if `banned` swallowed most of the range — a lattice must
  // still have `count` beams, so the ban is relaxed before the size is.
  for (let b = MIN_BEAM; b <= MAX_BEAM && chosen.size < count; b++) chosen.add(b)

  return [...chosen].sort((a, b) => a - b)
}

/**
 * A value the game may draw on an ordinary automaton: a positive integer of at
 * most three digits, killable somewhere on this lattice.
 *
 * Every automaton in the stream is killable. There is no "let it through"
 * verb in this game, so an unkillable automaton would be a guaranteed breach
 * the child could do nothing about.
 */
export function isFieldValue(beams: readonly number[], value: number): boolean {
  if (!Number.isInteger(value) || value < 2 || value > 999) return false
  return validBeamCount(beams, value) > 0
}

/**
 * Whether a curriculum answer can be the seed of a CORE wave.
 *
 * Two conditions, both load-bearing:
 *
 *   * It must have a divisor in the beam range, or no lattice can be tuned to
 *     kill it and the child would be asked for something impossible.
 *   * That divisor must be smaller than the value itself — i.e. the value is
 *     composite. If the only tuning were the value's own number, the beam label
 *     would print the answer at the foot of the lattice.
 *
 * An item whose answer fails this is not asked. It is dropped before the child
 * ever sees it, and it is never reported: silence is honest, a question with no
 * reachable answer is not.
 */
export function usableCoreValue(value: number): boolean {
  if (!Number.isInteger(value) || value < 4 || value > 9999) return false
  const d = beamDivisors(value)
  return d.length > 0 && (d[0] as number) < value
}
