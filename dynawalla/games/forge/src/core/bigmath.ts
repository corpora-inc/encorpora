// Exact arithmetic for the whole economy.
//
// Every quantity a player can see, spend, compare or brag about is a BigInt in
// MICRO units (10^-6). There is no float anywhere in this file, and no float
// reaches a cost, a threshold, a comparison or a displayed digit. An idle game
// that drifts is an idle game that lies, and a maths game that lies is worse
// than useless — so `4.0 x 10^11` here is exactly 400000000000000000 micro,
// forever, on every device, at any frame rate.
//
// Floats live in exactly one place: the renderer, where a pixel is a pixel.

export type Micro = bigint

export const MICRO = 1_000_000n
/**
 * Integer square root of a non-negative BigInt (Newton). Exact: returns the
 * largest r with r*r <= n. This is the prestige formula, and the game shows the
 * player the radical it just took.
 */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("isqrt of negative")
  if (n < 2n) return n
  // Seed from the bit length so Newton converges in ~log log n steps.
  let x = 1n << (BigInt(n.toString(2).length + 1) >> 1n)
  for (;;) {
    const y = (x + n / x) >> 1n
    if (y >= x) break
    x = y
  }
  return x
}

/** Exact integer power. */
export function ipow(base: bigint, exp: number): bigint {
  let r = 1n
  let b = base
  let e = exp
  while (e > 0) {
    if (e & 1) r *= b
    b *= b
    e >>= 1
  }
  return r
}

/** Number of decimal digits in |n| (n = 0 counts as 1). */
function digits(n: bigint): number {
  if (n === 0n) return 1
  const s = (n < 0n ? -n : n).toString()
  return s.length
}

/**
 * Base-10 order of magnitude of a micro quantity, as whole units.
 * 1 unit -> 0, 999 999 units -> 5, 10^6 units -> 6. Drives every milestone
 * punch in the game, so it is integer-only and cannot be nudged by rounding.
 */
export function orderOfMagnitude(m: Micro): number {
  const u = m / MICRO
  if (u <= 0n) return -1
  return digits(u) - 1
}

export type Readout = {
  /** "847,203" when small; "4.271" when large. */
  mantissa: string
  /** -1 when the value is shown plainly. */
  exponent: number
  /** True when `mantissa` is a plain integer with separators. */
  plain: boolean
}

const SCI_FLOOR = 1_000_000n // whole units at which we switch to 10^n

/**
 * The giant readout. Below a million it reads as an ordinary counting number —
 * a seven-year-old's first hour should look like counting. At a million it
 * flips to `4.271 x 10^6` and STAYS there, because from then on the exponent
 * is the interesting number and watching it tick is the whole point.
 */
export function readout(m: Micro, sigFigs = 4): Readout {
  const u = m < 0n ? 0n : m / MICRO
  if (u < SCI_FLOOR) {
    return { mantissa: groupDigits(u.toString()), exponent: -1, plain: true }
  }
  const s = u.toString()
  const exponent = s.length - 1
  // Take sigFigs digits exactly; no rounding, no float division. Truncation
  // means the readout never displays a value the player does not yet have.
  const head = s.slice(0, sigFigs).padEnd(sigFigs, "0")
  const mantissa = `${head.slice(0, 1)}.${head.slice(1)}`
  return { mantissa, exponent, plain: false }
}

/** Compact form for inline text: "12,400" or "3.4e9". */
export function compact(m: Micro): string {
  const r = readout(m, 3)
  return r.plain ? r.mantissa : `${r.mantissa}e${r.exponent}`
}

/** Rate readouts want one decimal below a million, e.g. "12.4 / s". */
export function rateText(m: Micro): string {
  const u = m / MICRO
  if (u < 1000n) {
    const tenths = (m * 10n) / MICRO
    return `${(tenths / 10n).toString()}.${(tenths % 10n).toString()}`
  }
  return compact(m)
}

function groupDigits(s: string): string {
  let out = ""
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ","
    out += s[i]
  }
  return out
}

/** Superscript digits for "10⁶" — the exponent is a character, not a font hack. */
const SUPS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]
export function superscript(n: number): string {
  const s = Math.abs(n).toString()
  let out = n < 0 ? "⁻" : ""
  for (const ch of s) out += SUPS[ch.charCodeAt(0) - 48]
  return out
}

