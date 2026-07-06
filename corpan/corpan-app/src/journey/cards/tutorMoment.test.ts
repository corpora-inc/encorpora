import { test } from "node:test"
import assert from "node:assert/strict"

import {
  buildTutorMomentMessages,
  TUTOR_MOMENT_MAX_WORDS,
  TUTOR_MOMENT_OPTIONS,
} from "./tutorMoment.ts"

test("buildTutorMomentMessages: null when no struggled items (no filler card)", () => {
  assert.equal(buildTutorMomentMessages({ targetLang: "English", struggled: [] }), null)
  assert.equal(
    buildTutorMomentMessages({ targetLang: "English", struggled: [{ text: "  " }] }),
    null,
  )
})

test("buildTutorMomentMessages: weaves up to N words, target-language directive", () => {
  const msgs = buildTutorMomentMessages({
    targetLang: "English",
    nativeLang: "Spanish",
    cefr: "A1",
    struggled: [{ text: "breakfast" }, { text: "early" }, { text: "coffee" }, { text: "extra" }],
  })
  assert.ok(msgs)
  const system = msgs![0].content
  assert.match(system, /entirely in English/)
  assert.match(system, /CEFR A1 level/)
  assert.match(system, /"breakfast"/)
  assert.match(system, /"coffee"/)
  // Capped — the 4th word is dropped.
  assert.doesNotMatch(system, /"extra"/)
})

test("buildTutorMomentMessages: cap constant honored", () => {
  const msgs = buildTutorMomentMessages({
    targetLang: "English",
    struggled: Array.from({ length: 6 }, (_, i) => ({ text: `w${i}` })),
  })
  const quoted = (msgs![0].content.match(/"w\d"/g) ?? []).length
  assert.equal(quoted, TUTOR_MOMENT_MAX_WORDS)
})

test("tutor options are low-temperature + non-thinking + token-capped", () => {
  assert.ok((TUTOR_MOMENT_OPTIONS.temperature ?? 1) <= 0.5)
  assert.equal(TUTOR_MOMENT_OPTIONS.noThink, true)
  assert.ok((TUTOR_MOMENT_OPTIONS.maxTokens ?? 999) <= 128)
})
