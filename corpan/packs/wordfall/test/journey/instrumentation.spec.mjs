/**
 * Journey instrumentation unit test (activity-contract §6.1).
 *
 * Drives the REAL journey modules (session + content) headless: a fixture spec
 * in, resolved tiles reported through a fake hostApi.journey, terminal
 * ActivityResult out. Game.ts / styles.css (canvas + DOM) are NOT pulled in —
 * this is the instrumentation seam, not the renderer.
 *
 * Proves:
 *   (a) content resolution — resolveRound picks target/native per the stack and
 *       degrades to immersion on a single-language stack (SINGLE_LANGUAGE_RULE);
 *       buildDistractors dedups against the correct answer;
 *   (b) per-item reporting — each resolved SPEC tile emits exactly one
 *       ActivityItemResult via hostApi.journey.reportItem; a resolved NON-spec
 *       (random top-up) tile is NOT reported;
 *   (c) terminal result — finish() reports exactly one ActivityResult with the
 *       clean-catch score, presentation-ordered perItem, specId echoed, and it
 *       is idempotent (second finish() is a no-op);
 *   (d) rail fallback — with no hostApi.journey, finish() rides the
 *       corpan:activity-result CustomEvent with packId "wordfall".
 *
 * Run:  node test/journey/instrumentation.spec.mjs   (node >= 18)
 */

import { fileURLToPath } from "node:url"
import path from "node:path"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import os from "node:os"

const here = path.dirname(fileURLToPath(import.meta.url))
const packRoot = path.join(here, "..", "..")
const src = path.join(packRoot, "src")

let failures = 0
const fail = (m) => { console.error("FAIL:", m); failures++ }
const ok = (m) => console.log("OK  ", m)
const assert = (cond, m) => { if (cond) ok(m); else fail(m) }

const { build } = await import("esbuild")

async function bundleAndImport(entryText) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "wf-journey-test-"))
  try {
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
  } finally {
    // Leave the tmp dir; OS cleans it. (rm can race the dynamic import on some FS.)
    void rmSync
  }
}

const mod = await bundleAndImport(`
  export { WordfallSession, PACK_ID, JOURNEY_ACTIVITY_TYPE } from ${JSON.stringify(path.join(src, "journey", "session.ts"))}
  export { resolveRound, buildDistractors } from ${JSON.stringify(path.join(src, "content.ts"))}
`)

const { WordfallSession, PACK_ID, resolveRound, buildDistractors } = mod

// ---------------------------------------------------------------- fixtures

const entry = (id, en, es) => ({
  entry_id: id,
  level: "A1",
  domains: ["travel"],
  translations: [
    { language_code: "en", text: en },
    { language_code: "es", text: es },
  ],
})

const SPEC = {
  specId: "js-test-0001",
  activityType: "wordfall:catch",
  itemRefs: [
    { kind: "phrase", source: "base", id: "1" },
    { kind: "phrase", source: "base", id: "2" },
  ],
  targetLang: "es",
  nativeLang: "en",
  params: { rounds: 2 },
}

// ------------------------------------------------------- (a) content resolution

{
  const c = resolveRound(entry(1, "water", "agua"), { languages: ["en", "es"] }, "es", "en")
  assert(c && c.targetText === "agua" && c.promptText === "water" && !c.immersion,
    "resolveRound: cross-language → target=agua, prompt=water")

  const imm = resolveRound(entry(1, "water", "agua"), { languages: ["es"] }, "es")
  assert(imm && imm.immersion && imm.promptText === "agua" && imm.targetText === "agua",
    "resolveRound: single-language stack → immersion (prompt === target, no gloss)")

  const pool = [entry(2, "cat", "gato"), entry(3, "dog", "perro"), entry(1, "water", "agua")]
  const distractors = buildDistractors(pool, c, "es", 3)
  assert(distractors.includes("gato") && distractors.includes("perro") && !distractors.includes("agua"),
    "buildDistractors: includes others, dedups the correct answer")
}

// ------------------------------------------------ (b)(c) reporting + terminal

{
  const reportedItems = []
  let terminal = null
  const hostApi = {
    speak: () => {},
    getStackConfig: () => ({ languages: ["en", "es"], domains: [], levels: [], rate: 1, textSize: "m", showRomanization: false }),
    journey: {
      isActive: () => true,
      getSpec: () => SPEC,
      reportItem: (it) => reportedItems.push(it),
      reportResult: (r) => { terminal = r },
      abandon: () => {},
    },
  }

  const s = new WordfallSession(SPEC, hostApi)
  assert(s.rounds === 2, "session.rounds honors params.rounds")
  assert(s.entryIds.length === 2 && s.entryIds[0] === 1 && s.entryIds[1] === 2,
    "session tracks spec entry ids in order")

  // Resolve tile for spec entry 1 = caught (pass).
  s.noteResolved(1, "caught", 900, 1)
  // A random top-up tile (entry 99, not in spec) resolves — must NOT report.
  s.noteResolved(99, "caught", 500, 2)
  // Resolve tile for spec entry 2 = wrong (fail).
  s.noteResolved(2, "wrong", 1200, 0)

  assert(reportedItems.length === 2, "reportItem: exactly the two SPEC tiles reported (top-up excluded)")
  assert(reportedItems[0].itemRef.id === "1" && reportedItems[0].outcome === "pass",
    "reportItem[0]: entry 1 pass")
  assert(reportedItems[1].itemRef.id === "2" && reportedItems[1].outcome === "fail",
    "reportItem[1]: entry 2 fail")

  const r = s.finish()
  assert(r && terminal && terminal.specId === "js-test-0001", "reportResult: terminal fired with echoed specId")
  assert(terminal.perItem.length === 2, "terminal.perItem: two faced items, in order")
  assert(terminal.perItem[0].itemRef.id === "1" && terminal.perItem[1].itemRef.id === "2",
    "terminal.perItem: presentation order preserved")
  assert(Math.abs(terminal.score - 0.5) < 1e-9, "terminal.score = clean-catch rate (1 of 2 = 0.5)")
  assert(terminal.detail?.numbers?.caught === 1 && terminal.detail?.numbers?.faced === 2,
    "terminal.detail.numbers carries faced/caught")
  assert(typeof terminal.durationMs === "number" && terminal.durationMs >= 0, "terminal.durationMs present")

  // Idempotent.
  const again = s.finish()
  assert(again === null, "finish() is idempotent — second call is a no-op")
}

// ------------------------------------------------------ (d) event-rail fallback

{
  const events = []
  const origAdd = globalThis.window
  globalThis.window = {
    dispatchEvent: (e) => { events.push(e); return true },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail } },
  }
  globalThis.CustomEvent = globalThis.window.CustomEvent

  const hostApiNoJourney = {
    speak: () => {},
    getStackConfig: () => ({ languages: ["en", "es"], domains: [], levels: [], rate: 1, textSize: "m", showRomanization: false }),
  }
  const s = new WordfallSession(SPEC, hostApiNoJourney)
  s.noteResolved(1, "caught", 800, 1)
  s.finish()
  const evt = events.find((e) => e.type === "corpan:activity-result")
  assert(!!evt, "no hostApi.journey → terminal result rides corpan:activity-result event")
  assert(evt?.detail?.packId === PACK_ID && evt.detail.packId === "wordfall",
    "event rail carries packId 'wordfall'")
  assert(evt?.detail?.result?.specId === "js-test-0001", "event-rail result carries the specId")

  globalThis.window = origAdd
}

// ---------------------------------------------------------------------------
console.log("")
if (failures) {
  console.error(`\n${failures} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log("All journey instrumentation assertions passed.")
}
