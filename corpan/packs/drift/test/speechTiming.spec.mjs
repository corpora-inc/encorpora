/**
 * speechTiming unit test — Drift paces its AUTO-narration against a spoken-word
 * estimate (WS-E), capped so a user-instant exit never hangs. Drives the REAL
 * speechTiming.ts headless via esbuild.
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
  const dir = mkdtempSync(path.join(os.tmpdir(), "drift-speechtiming-test-"))
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
  const fast = estimateSpeechDurationMs("una frase de prueba", 1.5)
  const slow = estimateSpeechDurationMs("una frase de prueba", 0.75)
  assert(fast < slow, "a higher rate shortens the estimate")
}

// ------------------------------------------------------ estimate (CJK-aware)

{
  // A spaceless Chinese sentence is ONE whitespace token but many spoken words;
  // it must estimate well above the 350ms single-word floor (≈2 glyphs/word).
  const zh = estimateSpeechDurationMs("我喜欢喝咖啡和茶因为很好喝")
  const oneWord = estimateSpeechDurationMs("hola")
  assert(zh > oneWord * 2, `unsegmented CJK estimates by glyph count (zh=${zh}ms)`)
  const zhShort = estimateSpeechDurationMs("好")
  assert(zhShort >= 350 && zhShort <= zh, "a single CJK glyph still floors at min")
}

// -------------------------------------------------------- waitForEstimatedSpeech

{
  const start = Date.now()
  await waitForEstimatedSpeech(0, 5000, 2000)
  assert(Date.now() - start < 50, "startedAt=0 (nothing spoken) ⇒ instant no-op")
}

{
  let t = 1000
  const now = () => t
  const start = Date.now()
  t = 1000 + 5000 // 5s already elapsed since the utterance started
  await waitForEstimatedSpeech(1000, 1200, 2000, now)
  assert(Date.now() - start < 50, "already-elapsed estimate ⇒ instant no-op")
}

{
  const start = Date.now()
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
