/**
 * speechTiming unit test — the endRun() → corpan:exit speech-wait estimate
 * (WS-C+G fix: the final spoken catch must not get cut off by the host's
 * teardown stopSpeech(), but exit must never hang).
 *
 * Run:  node test/speechTiming.spec.mjs   (node >= 18)
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
  const dir = mkdtempSync(path.join(os.tmpdir(), "wf-speechtiming-test-"))
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
  export * from ${JSON.stringify(path.join(src, "speechTiming.ts"))}
`)

const { estimateSpeechDurationMs, waitForEstimatedSpeech } = mod

// ---------------------------------------------------------------- estimate

{
  const one = estimateSpeechDurationMs("hola")
  const many = estimateSpeechDurationMs("hola buenos dias como estas hoy amigo")
  assert(many > one, "more words → longer estimate")
  assert(estimateSpeechDurationMs("") >= 350, "empty text still floors at the min duration")
  const huge = estimateSpeechDurationMs(new Array(500).fill("palabra").join(" "))
  assert(huge <= 6000, "a very long phrase is capped at the max duration")
}

// -------------------------------------------------------- waitForEstimatedSpeech

{
  const start = Date.now()
  await waitForEstimatedSpeech(0, 5000, 2000)
  assert(Date.now() - start < 50, "startedAt=0 (nothing spoken) ⇒ instant no-op")
}

{
  // A fake clock so the test doesn't depend on wall-clock jitter around
  // "already elapsed".
  let t = 1000
  const now = () => t
  const start = Date.now()
  t = 1000 + 5000 // 5s have already "passed" since the utterance started
  await waitForEstimatedSpeech(1000, 1200, 2000, now)
  assert(Date.now() - start < 50, "already-elapsed estimate ⇒ instant no-op")
}

{
  const start = Date.now()
  // estimatedDurationMs (5000) far exceeds capMs (80) — must not wait the full estimate.
  await waitForEstimatedSpeech(performance.now(), 5000, 80)
  const elapsed = Date.now() - start
  assert(elapsed >= 70 && elapsed < 400, `capped wait should be ~80ms, was ${elapsed}ms`)
}

// ---------------------------------------------------------------------------
console.log("")
if (failures) {
  console.error(`\n${failures} assertion(s) FAILED`)
  process.exit(1)
} else {
  console.log("All speechTiming assertions passed.")
}
