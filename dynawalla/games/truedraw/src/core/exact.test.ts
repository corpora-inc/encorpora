import assert from "node:assert/strict"
import { test } from "node:test"

import { canonicalNumeral, digitCount, sameValue } from "./exact.ts"

test("the same number written four ways canonicalises to one string", () => {
  for (const spelling of ["72", "072", "72.0", "+72", " 72 ", "72.000"]) {
    assert.equal(canonicalNumeral(spelling), "72", spelling)
  }
})

test("negative zero is zero, and so is every spelling of it", () => {
  for (const spelling of ["0", "-0", "0.0", "00", "-0.00", ".0"]) {
    assert.equal(canonicalNumeral(spelling), "0", spelling)
  }
})

test("a sign survives canonicalisation", () => {
  assert.equal(canonicalNumeral("-072.50"), "-72.5")
})

test("text that is not a decimal numeral is rejected rather than guessed at", () => {
  for (const junk of ["", " ", "+", ".", "1 234", "1,234", "seven", "1e3", "72px", "--3"]) {
    assert.equal(canonicalNumeral(junk), null, JSON.stringify(junk))
  }
})

test("sameValue is exact and never parses a float", () => {
  assert.equal(sameValue("72", "072"), true)
  assert.equal(sameValue("72", "72.0"), true)
  assert.equal(sameValue("72", "73"), false)
  // 17 significant digits: `Number()` would collapse these two onto the same
  // double and call them equal. The string comparison does not.
  assert.equal(sameValue("9007199254740993", "9007199254740992"), false)
  assert.equal(sameValue("0.1", "0.10000000000000001"), false)
})

test("sameValue refuses to call two non-numerals equal", () => {
  assert.equal(sameValue("", ""), false)
  assert.equal(sameValue("abc", "abc"), false)
})

test("digitCount counts glyphs, not value", () => {
  assert.equal(digitCount("4003 − 87 = 3916"), 10)
  assert.equal(digitCount("12 + 5 = 17"), 5)
  assert.equal(digitCount("no digits here"), 0)
})
