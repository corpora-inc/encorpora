/**
 * Stage 2 perf gate: measure PER-FRAME JANK on a COLD playthrough.
 *
 * We install a requestAnimationFrame loop that records frame deltas, drive past
 * onboarding, then walk CONTINUOUSLY in ONE direction into NEW territory for
 * ~20s (NOT re-walking the same chunks — that mistake hid the hitch last time).
 * Reports MAX frame time, p99 frame time, and the COUNT of frames > 25ms
 * (visible jank). Also dumps __wpSceneStats() after the walk.
 *
 * Usage: node qa/jank-cold.mjs [url]   (default http://localhost:5174)
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const WALK_MS = 20000

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))

// Pre-seed identity so onboarding is skipped (same trick as perf.mjs).
await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
})

await page.goto(url, { waitUntil: "load" })
// Let the city mount + spawn the first chunks.
await page.waitForSelector("canvas", { timeout: 20000 })
await page.waitForTimeout(2500)

// Install the rAF frame-delta recorder.
await page.evaluate(() => {
  const w = window
  w.__jank = { deltas: [], spikes: [], on: false, last: 0, t0: 0 }
  const tick = (t) => {
    const j = w.__jank
    if (j.on) {
      if (j.last) {
        const dt = t - j.last
        j.deltas.push(dt)
        if (dt > 25) j.spikes.push({ at: ((t - j.t0) / 1000).toFixed(1), ms: dt.toFixed(0) })
      } else {
        j.t0 = t
      }
      j.last = t
    } else {
      j.last = 0
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

// Walk CONTINUOUSLY in one direction (forward, no turning) into new territory.
// Start recording, then hold 'w' for the whole window.
await page.evaluate(() => {
  window.__jank.on = true
})
await page.keyboard.down("w")
await page.waitForTimeout(WALK_MS)
await page.keyboard.up("w")
await page.evaluate(() => {
  window.__jank.on = false
})

const result = await page.evaluate(() => {
  const d = window.__jank.deltas.slice().sort((a, b) => a - b)
  const n = d.length
  const p = (q) => d[Math.min(n - 1, Math.floor(n * q))]
  const count = (thr) => d.filter((x) => x > thr).length
  const stats = window.__wpSceneStats ? window.__wpSceneStats() : null
  return {
    frames: n,
    max: d[n - 1],
    p99: p(0.99),
    p95: p(0.95),
    median: p(0.5),
    over16: count(16.7),
    over22: count(22),
    over25: count(25),
    over33: count(33),
    spikes: window.__jank.spikes,
    stats,
  }
})

// Memory after a FULL warm: keep idling a bit so the background warm finishes,
// then sample again to prove memory is BOUNDED (not ballooning).
await page.waitForTimeout(8000)
const warmStats = await page.evaluate(() => (window.__wpSceneStats ? window.__wpSceneStats() : null))

// Confirm the world rendered (canvas present) and read the live near-chunk log.
await page.screenshot({ path: "/tmp/wp-stage2.png" })

console.log("=== PER-FRAME JANK (cold walk, one direction, " + WALK_MS / 1000 + "s) ===")
console.log(`frames recorded: ${result.frames}`)
console.log(`MAX:    ${result.max.toFixed(1)}ms`)
console.log(`p99:    ${result.p99.toFixed(1)}ms`)
console.log(`p95:    ${result.p95.toFixed(1)}ms`)
console.log(`median: ${result.median.toFixed(1)}ms`)
console.log(`frames > 16.7ms: ${result.over16}`)
console.log(`frames > 22ms:   ${result.over22}`)
console.log(`frames > 25ms:   ${result.over25}   <-- visible jank count`)
console.log(`frames > 33ms:   ${result.over33}`)
console.log("spikes (>25ms):", JSON.stringify(result.spikes))
console.log("=== __wpSceneStats() right after walk ===")
console.log(JSON.stringify(result.stats, null, 2))
console.log("=== __wpSceneStats() after +8s full-warm idle (bounded check) ===")
console.log(JSON.stringify(warmStats, null, 2))
console.log(`pageerrors: ${pageErrors.length}`)
for (const e of pageErrors) console.log("  ERR:", e)
console.log(`screenshot: /tmp/wp-stage2.png`)

await browser.close()
