/**
 * Integer → digit places, into a caller-owned buffer.
 *
 * Pulled out of the numeral layer so it can be tested without a GPU. The
 * float-safe divide is deliberate: a run deep into overdrive passes 2^31, and
 * an `| 0` truncation there prints a *different number* on a screen whose
 * entire job is comparing numbers.
 *
 * Returns the digit count; `out[0]` is the ones place.
 */
export function splitDigits(value: number, out: Int32Array): number {
  let n = Math.abs(Math.round(value))
  if (!Number.isFinite(n)) n = 0
  if (n === 0) {
    out[0] = 0
    return 1
  }
  let count = 0
  while (n > 0 && count < out.length) {
    out[count++] = n % 10
    n = Math.floor(n / 10)
  }
  // Ran out of buffer. Returning here would print the LOW `out.length` digits —
  // a different number, drawn with total confidence, which is the exact failure
  // this function's float-safe divide exists to prevent. A row of `9`s is
  // wrong in a way a child can see.
  if (n > 0) {
    for (let i = 0; i < out.length; i++) out[i] = 9
    return out.length
  }
  return count
}

/**
 * Storage for a numeral's VALUE, as opposed to its position or its size.
 *
 * It is `Float64Array` and that is the whole point of the function existing.
 * `splitDigits` above goes to the trouble of being float-safe past 2^31, and a
 * `Float32Array` holding the pending label values undoes that silently on the
 * way in: 8,030,000,000 comes back out as 8,030,000,128, and anything past
 * 2^24 at all comes back rounded. A *different number* then gets drawn, on a
 * screen whose entire job is comparing numbers, with nothing anywhere to say
 * so.
 *
 * Positions, cap heights and colours stay Float32 — a third of a pixel of drift
 * is invisible. Values do not get that latitude.
 */
export function valueBuffer(n: number): Float64Array {
  return new Float64Array(n)
}

/**
 * Round a magnitude to about three significant figures once it is large.
 *
 * `4820` is a place-value comparison a child can win in half a second; `4817`
 * is the same comparison with two digits of noise stapled to it. Small values
 * pass through untouched, because at small magnitudes every digit matters.
 */
export function tidyValue(v: number): number {
  const sign = v < 0 ? -1 : 1
  const a = Math.abs(v)
  if (a < 1000) return sign * Math.max(1, Math.round(a))
  const step = a < 10000 ? 10 : a < 100000 ? 100 : a < 1000000 ? 1000 : 10000
  return sign * Math.max(1, Math.round(a / step) * step)
}
