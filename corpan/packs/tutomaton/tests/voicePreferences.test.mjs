import assert from "node:assert/strict"
import test from "node:test"

import { chooseTutorVoice, sortTutorVoices } from "../src/voicePreferences.ts"

const voice = (id, language, quality, networkRequired = false) => ({
  id,
  name: id,
  language,
  quality,
  networkRequired,
})

test("defaults to the best installed offline voice for the requested dialect", () => {
  const voices = [
    voice("compact-us", "en-US", "default"),
    voice("premium-gb", "en-GB", "premium"),
    voice("premium-us", "en-US", "premium"),
  ]
  assert.equal(chooseTutorVoice(voices, "en-US", null)?.id, "premium-us")
})

test("keeps a persisted voice selected when it remains installed", () => {
  const voices = [
    voice("premium", "fr-FR", "premium"),
    voice("chosen", "fr-FR", "enhanced"),
  ]
  assert.equal(chooseTutorVoice(voices, "fr-FR", "chosen")?.id, "chosen")
})

test("prefers offline voices and deterministically falls back when a saved voice disappears", () => {
  const voices = [
    voice("network", "es-MX", "premium", true),
    voice("offline", "es-MX", "enhanced"),
  ]
  assert.deepEqual(sortTutorVoices(voices, "es-MX").map((item) => item.id), ["offline", "network"])
  assert.equal(chooseTutorVoice(voices, "es-MX", "removed")?.id, "offline")
})
