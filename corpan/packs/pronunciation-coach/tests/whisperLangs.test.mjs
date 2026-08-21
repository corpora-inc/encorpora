import assert from "node:assert/strict"
import test from "node:test"

import {
  WHISPER_SUPPORTED,
  isWhisperSupported,
  stackHasScorableLang,
  toWhisperLang,
} from "../../shared/capabilities/pronounce/src/whisperLangs.ts"

// The full Corpán target set the app can put in a learning stack. Keep in sync
// with corpan-app/src/store/constants.ts. The test pins exactly which of these
// whisper cannot score, so adding a new stack language that silently breaks
// scoring trips this guard.
const CORPAN_TARGETS = [
  "en", "es", "fr", "it", "pt-BR", "de", "sv", "no", "da", "nl", "pl", "ru",
  "hu", "fi", "tr", "el", "he", "ar", "fa", "hi", "bn", "th", "vi", "id", "jv",
  "su", "ms", "tl", "sw", "zh-Hans", "zh-Hant", "ko-polite", "ja", "ta", "te",
  "kn", "mr", "gu", "pa-Guru", "pa-Arab", "ur", "ne", "pt-PT", "hr", "sr", "uk",
  "bg", "ro", "ca", "yue-Hant-HK", "cs", "lt", "sk", "sl",
]

// Whisper has no Cantonese code (it folds Cantonese into `zh`/Mandarin), so it
// is gated out on purpose. Everything else maps to a supported whisper code.
const INTENTIONALLY_UNSUPPORTED = ["yue-Hant-HK"]

test("Javanese is recovered via the jv → jw alias", () => {
  assert.equal(toWhisperLang("jv"), "jw")
  assert.equal(isWhisperSupported("jv"), true)
  assert.ok(WHISPER_SUPPORTED.has("jw"))
  assert.ok(!WHISPER_SUPPORTED.has("jv"))
})

test("Cantonese (yue-Hant-HK) is unsupported on purpose", () => {
  assert.equal(toWhisperLang("yue-Hant-HK"), null)
  assert.equal(isWhisperSupported("yue-Hant-HK"), false)
})

test("script/variant codes collapse to a supported base", () => {
  assert.equal(toWhisperLang("pt-BR"), "pt")
  assert.equal(toWhisperLang("ko-polite"), "ko")
  assert.equal(toWhisperLang("zh-Hans"), "zh")
  assert.equal(toWhisperLang("zh-Hant"), "zh")
  assert.equal(toWhisperLang("pa-Arab"), "pa")
  assert.equal(toWhisperLang("pa-Guru"), "pa")
})

test("empty / unknown codes are unsupported", () => {
  assert.equal(toWhisperLang(""), null)
  assert.equal(toWhisperLang("zz"), null)
  assert.equal(isWhisperSupported(""), false)
})

test("every Corpán target either maps or is intentionally gated", () => {
  const unsupported = CORPAN_TARGETS.filter((c) => !isWhisperSupported(c))
  assert.deepEqual(
    unsupported.sort(),
    [...INTENTIONALLY_UNSUPPORTED].sort(),
    `unexpected unscorable language(s): ${unsupported.join(", ")}`
  )
})

test("stackHasScorableLang reflects the target slots", () => {
  // languages[0] is native; [1..] are targets.
  assert.equal(stackHasScorableLang(["en", "yue-Hant-HK"]), false) // only target unscorable
  assert.equal(stackHasScorableLang(["en", "yue-Hant-HK", "es"]), true)
  assert.equal(stackHasScorableLang(["en", "jv"]), true) // Javanese now scorable
  assert.equal(stackHasScorableLang(["yue-Hant-HK"]), false) // single unscorable
  assert.equal(stackHasScorableLang(["es"]), true) // single scorable
  assert.equal(stackHasScorableLang([]), false)
})
