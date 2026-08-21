// Cross-engine determinism: does the SAME scene produce the SAME state in
// Node/V8, Chrome/V8 and WebKit/JavaScriptCore?
//
// This is the question a maths product actually has to answer, because the two
// runtimes we ship into are a Chromium WebView on Android and WKWebView (which
// is JavaScriptCore) on iOS. "Rapier is deterministic" is a claim about one
// binary on one machine and is not by itself an answer.
//
// It runs a fixed, seeded scene for a fixed number of steps and prints the
// quantised state hash from each engine, plus the raw f32 of a few bodies so a
// divergence can be localised rather than just detected.
//
//   node bench/determinism.mjs              (requires `npm run demo` running)
//
// The scene is deliberately nasty: a stack that topples, loose liquid
// particles, and a jointed chain — contacts, islands and constraints all at
// once, which is where an ordering difference would show up first.

import { setTimeout as sleep } from "node:timers/promises"

const PORT = 1425
const BASE = `http://localhost:${PORT}`
const STEPS = 900
const SEED = 20260726

async function runNode() {
  const { createWorld } = await import("../src/index.ts")
  const w = await createWorld({ seed: SEED, tier: "mid" })
  buildScene(w)
  w.stepExact(STEPS)
  const out = { hash: w.hash(), probe: probe(w) }
  w.dispose()
  return out
}

/** Kept in one place so Node and the browsers cannot drift apart. */
export function buildScene(w) {
  w.ground(20)
  w.stack({ at: [0, 0], rows: 8, size: 0.28 })
  w.chain({ from: [-7, 9], links: 18, load: 40 })
  w.liquid({ at: [3, 12], count: 120, drop: 0.11 })
  const gun = w.launcher({ at: [-9, 6] })
  gun.fire({ angle: 0.18, speed: 15 })
  return w
}

export function probe(w) {
  // First, middle and last live body, at full f32 precision.
  const n = w.count
  const pick = [0, n >> 1, n - 1]
  return pick.map((i) => [w.transforms[i * 4], w.transforms[i * 4 + 1]].map((v) => v.toExponential(9)).join(","))
}

const node = await runNode()
console.log(`Node ${process.version} / V8`.padEnd(34) + node.hash)

const { chromium, webkit } = await import("playwright")
const engines = [
  ["Chrome / V8", () => chromium.launch({ channel: "chrome" })],
  ["WebKit / JavaScriptCore", () => webkit.launch()],
]

const rows = [{ engine: `Node ${process.version} / V8`, ...node }]
for (const [name, launch] of engines) {
  let browser
  try {
    browser = await launch()
  } catch (err) {
    console.log(`${name.padEnd(34)} unavailable (${String(err).split("\n")[0]})`)
    continue
  }
  const page = await browser.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e)))
  await page.goto(`${BASE}/determinism.html?seed=${SEED}&steps=${STEPS}`, { waitUntil: "load" })
  try {
    await page.waitForFunction("globalThis.__det !== undefined", null, { timeout: 120_000 })
  } catch {
    console.log(`${name.padEnd(34)} TIMED OUT ${errs[0] ?? ""}`)
    await browser.close()
    continue
  }
  const det = await page.evaluate("globalThis.__det")
  console.log(`${name.padEnd(34)}${det.hash}   ${await browser.version()}`)
  rows.push({ engine: name, ...det })
  await browser.close()
  await sleep(50)
}

const allSame = rows.every((r) => r.hash === rows[0].hash)
console.log(
  `\n${rows.length} engines, ${STEPS} steps, seed ${SEED}: ` +
    (allSame ? "IDENTICAL state hash" : "DIVERGED"),
)
if (!allSame) {
  for (const r of rows) console.log(`  ${r.engine.padEnd(30)} ${r.hash}  ${r.probe.join("  ")}`)
}
