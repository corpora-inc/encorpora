// Combo-reactive chime-pitch tests (PREMIUM_SCROLL §3.3): the chime climbs the
// pentatonic ladder with the combo and keeps rising past the base scale by
// octave shifts, but caps so it never gets shrill.

import { test } from "node:test"
import assert from "node:assert/strict"
import { chimeRung, ttsSpeaking } from "./sounds.ts"
import { beginUtterance, endUtterance, _resetAudioManagerForTests } from "../../util/audioManager.ts"

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

// Celebration-trigger coverage (wave-1 audio manager regression risk): the
// ttsSpeaking() gate now also reads the estimate-based isUtteranceActive()
// (native TTS has no true onend signal — see audioManager.ts), which can
// stay "active" for seconds after a card's own mount-autoplay prompt
// (choice_pick toNative/audio-fallback, listen_pick, image/glyph modes) has
// actually finished. ActivityCardHost.settle() defuses this by calling
// endUtterance() right before firing a celebration, so a stale prompt-audio
// estimate can never silently swallow the fresh correct-answer chime.
test("a stale (but still-estimated-active) utterance suppresses the chime gate", () => {
  _resetAudioManagerForTests()
  assert.equal(ttsSpeaking(), false, "nothing tracked ⇒ chime is never dropped")
  beginUtterance("hola buenos dias como estas hoy amigo", 1) // long prompt, still "active"
  assert.equal(ttsSpeaking(), true, "an in-window estimate reads as speaking ⇒ would drop the chime")
})

test("endUtterance() clears a stale estimate so the chime gate reopens — the settle() fix", () => {
  _resetAudioManagerForTests()
  beginUtterance("hola buenos dias como estas hoy amigo", 1)
  assert.equal(ttsSpeaking(), true, "precondition: the stale estimate is still gating")
  endUtterance() // exactly what settle() now does before celebrate()
  assert.equal(ttsSpeaking(), false, "cleared ⇒ the correct-answer chime is never silently dropped")
})
