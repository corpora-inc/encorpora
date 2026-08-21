/**
 * challenge unit test — the Drift "tap the word you heard" generation + scoring
 * (WS-E: the reader gained a real, scored game loop). Drives the REAL
 * challenge.ts headless via esbuild (mirrors wordfall's test harness).
 *
 * Proves:
 *   (a) one challenge per beat that has a content word + a distractor;
 *   (b) the target is a real content word of its beat, and options include it;
 *   (c) options are distinct, within [MIN..MAX], and carry the beat's itemRef;
 *   (d) generation is deterministic for a fixed seed;
 *   (e) a lone word with no possible distractor yields no challenge;
 *   (f) normalizeWord / isCorrectPick ignore surrounding punctuation + case;
 *   (g) scoreChallenges aggregates correctly (empty ⇒ 0).
 *
 * Run:  node test/challenge.spec.mjs   (node >= 18)
 */

import { fileURLToPath } from "node:url"
import path from "node:path"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"

const here = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.join(here, "..")
const src = path.join(packRoot, "src")

let failures = 0
const fail = (m) => { console.error("FAIL:", m); failures++ }
const ok = (m) => console.log("OK  ", m)
const assert = (cond, m) => { if (cond) ok(m); else fail(m) }

const { build } = await import("esbuild")

async function bundleAndImport(entryText) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "drift-challenge-test-"))
  const entry = path.join(dir, "entry.ts")
  writeFileSync(entry, entryText)
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    write: false,
    platform: "node",
    absWorkingDir: dir,
  })
  const code = res.outputFiles[0].text
  const mod = path.join(dir, "out.mjs")
  writeFileSync(mod, code)
  return await import(mod + "?t=" + Date.now())
}

const mod = await bundleAndImport(`
  export * from ${JSON.stringify(path.join(src, "challenge.ts"))}
`)

const {
  buildChallenges,
  scoreChallenges,
  normalizeWord,
  isCorrectPick,
  MIN_OPTIONS,
  MAX_OPTIONS,
} = mod

// --- helpers to fabricate a ComposedStory --------------------------------

const tok = (text, gloss) => ({ text, glossable: !/^\s+$/.test(text), gloss })
/** Build a beat from a target sentence; every space-split word is glossable. */
function beat(target, gloss, itemRef) {
  const parts = target.match(/\S+|\s+/g) ?? [target]
  return {
    motif: "dawn",
    targetText: target,
    nativeGloss: gloss ?? "",
    tokens: parts.map((p) => tok(p, /^\s+$/.test(p) ? undefined : gloss)),
    ...(itemRef ? { itemRef } : {}),
  }
}
function story(beats) {
  return { scene: { id: "s", hue: 205, motifs: [] }, beats, targetLang: "es", nativeLang: "en" }
}

const ref = (id) => ({ kind: "phrase", source: "base", id: String(id) })

// ---------------------------------------------------------------- (a)(b)(c)

{
  const s = story([
    beat("la mañana tranquila", "the quiet morning", ref(1)),
    beat("el mar despacio", "the sea slowly", ref(2)),
  ])
  const ch = buildChallenges(s, 7)
  assert(ch.length === 2, `one challenge per viable beat (got ${ch.length})`)
  for (const c of ch) {
    const beatText = s.beats[c.beatIndex].targetText
    assert(beatText.includes(c.targetWord), `target "${c.targetWord}" belongs to its beat`)
    assert(c.options.includes(c.targetWord), "options include the target")
    assert(
      c.options.length >= MIN_OPTIONS && c.options.length <= MAX_OPTIONS,
      `option count within [${MIN_OPTIONS}..${MAX_OPTIONS}] (got ${c.options.length})`,
    )
    const keys = new Set(c.options.map((o) => o.toLocaleLowerCase()))
    assert(keys.size === c.options.length, "options are distinct")
    assert(c.itemRef && c.itemRef.id === s.beats[c.beatIndex].itemRef.id, "challenge carries the beat's itemRef")
  }
}

// ---------------------------------------------------------------- (d)

{
  const s = story([
    beat("la mañana tranquila", "morning", ref(1)),
    beat("el mar despacio", "sea", ref(2)),
    beat("la luz recuerdo", "light", ref(3)),
  ])
  const a = JSON.stringify(buildChallenges(s, 42))
  const b = JSON.stringify(buildChallenges(s, 42))
  const c = JSON.stringify(buildChallenges(s, 43))
  assert(a === b, "same seed ⇒ identical challenges (deterministic)")
  assert(a !== c || true, "different seed may differ (not asserted as a hard requirement)")
}

// ---------------------------------------------------------------- (e)

{
  // A single one-word story: no distractor exists ⇒ no challenge posable.
  const s = story([beat("hola", "hi", ref(1))])
  const ch = buildChallenges(s, 1)
  assert(ch.length === 0, "a lone word with no distractor yields no challenge")
}

// ---------------------------------------------------------------- (e2) CJK

{
  // Unsegmented han/kana: the tokenizer yields the WHOLE LINE as one "word".
  // Such a token must never be posed as a tap-the-word target (or distractor).
  const s = story([
    beat("我喜欢喝咖啡和茶", "I like coffee and tea", ref(1)),
    beat("今天天气很好", "nice weather today", ref(2)),
  ])
  const ch = buildChallenges(s, 1)
  assert(ch.length === 0, "unsegmented CJK sentences yield no challenges")

  // But short, word-sized CJK tokens (whitespace-segmented input) still play.
  const s2 = story([
    beat("咖啡 好喝", "coffee tastes good", ref(1)),
    beat("天气 很好", "weather is nice", ref(2)),
  ])
  const ch2 = buildChallenges(s2, 1)
  assert(ch2.length === 2, "word-sized CJK tokens still pose challenges")
}

// ---------------------------------------------------------------- (f)

{
  assert(normalizeWord("¡Hola!") === "Hola", "normalizeWord strips surrounding punctuation")
  assert(normalizeWord("  mar,") === "mar", "normalizeWord trims + strips trailing punctuation")
  assert(isCorrectPick("Mañana", "mañana.") === true, "isCorrectPick ignores case + punctuation")
  assert(isCorrectPick("mar", "luz") === false, "isCorrectPick rejects a different word")
}

// ---------------------------------------------------------------- (g)

{
  const c1 = { beatIndex: 0, targetWord: "mar", targetGloss: "", options: ["mar", "luz"] }
  const c2 = { beatIndex: 1, targetWord: "luz", targetGloss: "", options: ["luz", "mar"] }
  const all = scoreChallenges([
    { challenge: c1, correct: true, latencyMs: 500 },
    { challenge: c2, correct: false, latencyMs: 800 },
  ])
  assert(all.faced === 2 && all.correct === 1, "counts faced + correct")
  assert(Math.abs(all.score - 0.5) < 1e-9, "score is correct/faced")
  const perfect = scoreChallenges([{ challenge: c1, correct: true, latencyMs: 1 }])
  assert(perfect.score === 1, "all correct ⇒ score 1")
  const none = scoreChallenges([])
  assert(none.score === 0 && none.faced === 0, "no answers ⇒ score 0 (never NaN)")
}

// ---------------------------------------------------------------------------
console.log("")
if (failures) {
  console.error(`\n${failures} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log("All challenge assertions passed.")
}
