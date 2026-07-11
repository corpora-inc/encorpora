// Combo-reactive chime-pitch tests (PREMIUM_SCROLL §3.3): the chime climbs the
// pentatonic ladder with the combo and keeps rising past the base scale by
// octave shifts, but caps so it never gets shrill.

import { test } from "node:test"
import assert from "node:assert/strict"
import { chimeRung } from "./sounds.ts"

test("pitch never falls with combo depth, and keeps climbing across octaves", () => {
  const rungs = [0, 1, 2, 3, 4, 5, 6, 8, 12, 18].map(chimeRung)
  for (let i = 1; i < rungs.length; i++) {
    // non-decreasing everywhere (octave wraps land on the same note briefly)
    assert.ok(rungs[i] >= rungs[i - 1], `rung ${i} should not fall below ${i - 1}`)
  }
  // a longer streak is audibly higher than a short one
  assert.ok(chimeRung(12) > chimeRung(2))
  assert.ok(chimeRung(6) > chimeRung(0))
})

test("climb caps at +2 octaves (never shrill)", () => {
  // Octave shift saturates at +2, so every very-long streak stays under the
  // ceiling (top pentatonic note at +2 octaves).
  const ceiling = 1046.5 * 4
  for (const depth of [200, 500, 1000, 9999]) {
    assert.ok(chimeRung(depth) <= ceiling + 0.001, `depth ${depth} exceeded ceiling`)
  }
  // and the octave really does stop climbing: same base-note rung at +5 octaves
  // worth of depth equals the +2 cap.
  assert.equal(chimeRung(12), chimeRung(12 + 6 * 5)) // +5 octaves capped to +2
})

test("depth 0 is the base note", () => {
  assert.equal(chimeRung(0), 523.25)
})
