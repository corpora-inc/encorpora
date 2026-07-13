/**
 * session unit test — the Drift journey reporting contract (activity-contract
 * §3). Drives the REAL session.ts headless via esbuild.
 *
 * Proves:
 *   (a) per-item evidence is streamed (reportItem) ONLY for spec-scheduled
 *       itemRefs; random-fill beats (not in the spec) are scenery;
 *   (b) outcomes map correct→pass / wrong→fail, in first-faced order;
 *   (c) the aggregate score counts ALL faced challenges (score = correct/faced);
 *   (d) finish() reports exactly one terminal result and is idempotent;
 *   (e) a Done tap before completion calls journey.abandon() (host synthesizes
 *       the abandoned result) — the pack never fakes a terminal result.
 *
 * Run:  node test/session.spec.mjs   (node >= 18)
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
  const dir = mkdtempSync(path.join(os.tmpdir(), "drift-session-test-"))
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
  export * from ${JSON.stringify(path.join(src, "session.ts"))}
`)
const { DriftSession } = mod

function fakeHost() {
  const items = []
  const results = []
  const abandons = []
  return {
    calls: { items, results, abandons },
    getStackConfig: () => ({ languages: ["en", "es"], domains: [], levels: [], rate: 1, textSize: "m", showRomanization: false }),
    speak: () => {},
    journey: {
      isActive: () => true,
      getSpec: () => null,
      reportItem: (i) => items.push(i),
      reportResult: (r) => results.push(r),
      abandon: (reason) => abandons.push(reason),
    },
  }
}

const ref = (id) => ({ kind: "phrase", source: "base", id: String(id) })
const spec = {
  specId: "spec-1",
  activityType: "drift:read",
  itemRefs: [ref(1), ref(2)],
  targetLang: "es",
  nativeLang: "en",
}

// ---------------------------------------------------------------- (a)(b)(c)

{
  const host = fakeHost()
  const s = new DriftSession(spec, host)
  s.noteAnswer(ref(1), true, 400)   // spec item → reported (pass)
  s.noteAnswer(undefined, false, 900) // random-fill beat, no ref → tally only
  s.noteAnswer(ref(2), false, 700)  // spec item → reported (fail)
  s.noteAnswer(ref(99), true, 300)  // NOT in spec → tally only, not reported

  assert(host.calls.items.length === 2, "only the two spec items streamed reportItem")
  assert(host.calls.items[0].outcome === "pass", "first spec item mapped correct→pass")
  assert(host.calls.items[1].outcome === "fail", "second spec item mapped wrong→fail")

  const result = s.buildResult(false)
  assert(result.perItem.length === 2, "terminal perItem carries only spec items")
  assert(result.detail.numbers.faced === 4, "faced counts ALL answered challenges")
  assert(result.detail.numbers.correct === 2, "correct counts all correct answers")
  assert(Math.abs(result.score - 0.5) < 1e-9, "aggregate score = correct/faced (2/4)")
  assert(result.abandoned === undefined, "a natural result is not abandoned")
}

// ---------------------------------------------------------------- (d)

{
  const host = fakeHost()
  const s = new DriftSession(spec, host)
  s.noteAnswer(ref(1), true, 200)
  const first = s.finish()
  const second = s.finish()
  assert(host.calls.results.length === 1, "finish() reports exactly one terminal result")
  assert(host.calls.results[0].specId === "spec-1", "terminal result carries the specId")
  assert(first && second === null, "finish() is idempotent (second call is a no-op)")
}

// ---------------------------------------------------------------- (e)

{
  const host = fakeHost()
  const s = new DriftSession(spec, host)
  s.noteAnswer(ref(1), true, 200)
  s.abandon("user_exit")
  assert(host.calls.abandons.length === 1 && host.calls.abandons[0] === "user_exit",
    "Done-before-completion calls journey.abandon('user_exit')")
  assert(host.calls.results.length === 0, "abandon never fakes a terminal reportResult")
  assert(s.finish() === null, "finish() after abandon is a no-op (already reported)")
}

// ---------------------------------------------------------------------------
console.log("")
if (failures) {
  console.error(`\n${failures} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log("All session assertions passed.")
}
