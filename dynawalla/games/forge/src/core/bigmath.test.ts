import { strict as assert } from "node:assert"
import { test } from "node:test"

import { MICRO, compact, isqrt, ipow, orderOfMagnitude, readout, superscript } from "./bigmath.ts"

test("isqrt is exact at every size", () => {
  for (let n = 0n; n < 400n; n++) {
    const r = isqrt(n)
    assert.ok(r * r <= n, `${r}^2 <= ${n}`)
    assert.ok((r + 1n) * (r + 1n) > n, `(${r}+1)^2 > ${n}`)
  }
  // Perfect squares, including ones no double can represent.
  for (const k of [10n ** 20n, 123456789n, 2n ** 61n + 1n]) {
    assert.equal(isqrt(k * k), k)
    assert.equal(isqrt(k * k - 1n), k - 1n)
  }
})

test("isqrt of a 200-digit number is exact", () => {
  const n = 10n ** 200n + 7n
  const r = isqrt(n)
  assert.ok(r * r <= n)
  assert.ok((r + 1n) * (r + 1n) > n)
})

test("ipow is exact", () => {
  assert.equal(ipow(23n, 0), 1n)
  assert.equal(ipow(23n, 5), 23n * 23n * 23n * 23n * 23n)
  assert.equal(ipow(2n, 64), 18446744073709551616n)
})

test("readout truncates and never inflates", () => {
  // 999 999 micro-sparks is not one spark.
  assert.deepEqual(readout(999_999n), { mantissa: "0", exponent: -1, plain: true })
  assert.deepEqual(readout(1_234n * MICRO), { mantissa: "1,234", exponent: -1, plain: true })
  const r = readout(4_271_999_999n * MICRO)
  assert.equal(r.plain, false)
  assert.equal(r.exponent, 9)
  // Truncation, not rounding: 4.271e9, never 4.272e9.
  assert.equal(r.mantissa, "4.271")
})

test("readout pads short mantissas rather than lying", () => {
  const r = readout(1_000_000n * MICRO)
  assert.equal(r.mantissa, "1.000")
  assert.equal(r.exponent, 6)
})

test("orderOfMagnitude is integer and matches digit count", () => {
  assert.equal(orderOfMagnitude(0n), -1)
  assert.equal(orderOfMagnitude(MICRO), 0)
  assert.equal(orderOfMagnitude(999n * MICRO), 2)
  assert.equal(orderOfMagnitude(1000n * MICRO), 3)
  assert.equal(orderOfMagnitude(10n ** 40n * MICRO), 40)
})

test("compact never returns exponential notation for small counts", () => {
  assert.equal(compact(12n * MICRO), "12")
  assert.equal(compact(999_999n * MICRO), "999,999")
  assert.equal(compact(1_000_000n * MICRO), "1.00e6")
})

test("superscript renders every digit", () => {
  assert.equal(superscript(0), "⁰")
  assert.equal(superscript(1234567890), "¹²³⁴⁵⁶⁷⁸⁹⁰")
})
