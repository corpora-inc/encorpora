/**
 * Stage 3 perf gate: COLD per-frame jank + ground-memory sweep.
 *
 * Records frame deltas from t0, walks CONTINUOUSLY into NEW territory ~20s (never
 * re-walking — that hid the hitch before), and reports MAX / p99-after-2s and the
 * jank counts SPLIT into first-2s vs after-2s so the startup spike is visible.
 * Then walks a broad sweep and dumps __wpSceneStats() to prove ground memory.
 *
 * Usage: node qa/jank-stage3.mjs [url]   (default http://localhost:5174)
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const WALK_MS = 20000

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))

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
await page.waitForSelector("canvas", { timeout: 20000 })
// Install the rAF recorder IMMEDIATELY (capture the startup spike), then start.
await page.evaluate(() => {
  const w = window
  w.__jank = { deltas: [], spikes: [], on: false, last: 0, t0: 0 }
  const tick = (t) => {
    const j = w.__jank
    if (j.on) {
      if (j.last) {
        const dt = t - j.last
        const at = (t - j.t0) / 1000
        j.deltas.push({ at, dt })
        if (dt > 25) j.spikes.push({ at: at.toFixed(1), ms: dt.toFixed(0) })
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

// Start recording at the SAME instant the city begins to mount its first chunks
// (the controller spawns immediately after canvas). Hold 'w' for the window.
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
  const all = window.__jank.deltas
  const first = all.filter((x) => x.at < 2).map((x) => x.dt)
  const after = all.filter((x) => x.at >= 2).map((x) => x.dt)
  const d = after.slice().sort((a, b) => a - b)
  const n = d.length
  const p = (q) => d[Math.min(n - 1, Math.floor(n * q))]
  const cnt = (arr, thr) => arr.filter((x) => x > thr).length
  const stats = window.__wpSceneStats ? window.__wpSceneStats() : null
  return {
    frames: all.length,
    maxAll: Math.max(...all.map((x) => x.dt)),
    p99After: p(0.99),
    p95After: p(0.95),
    medianAfter: p(0.5),
    first2_over25: cnt(first, 25),
    first2_over33: cnt(first, 33),
    after2_over25: cnt(after, 25),
    after2_over33: cnt(after, 33),
    spikes: window.__jank.spikes,
    stats,
  }
})

// Broad sweep: walk a few more directions so a wide spread of chunks is built,
// then sample stats (proves ground memory is shared/bounded across many chunks).
for (const key of ["d", "w", "a", "s"]) {
  await page.keyboard.down(key)
  await page.waitForTimeout(4000)
  await page.keyboard.up(key)
}
await page.waitForTimeout(6000)
const sweepStats = await page.evaluate(() => (window.__wpSceneStats ? window.__wpSceneStats() : null))

await page.screenshot({ path: "/tmp/wp-stage3.png" })

console.log("=== STAGE 3 PER-FRAME JANK (cold walk, " + WALK_MS / 1000 + "s) ===")
console.log(`frames recorded: ${result.frames}`)
console.log(`MAX (all):        ${result.maxAll.toFixed(1)}ms`)
console.log(`p99 (after 2s):   ${result.p99After.toFixed(1)}ms`)
console.log(`p95 (after 2s):   ${result.p95After.toFixed(1)}ms`)
console.log(`median (after2s): ${result.medianAfter.toFixed(1)}ms`)
console.log(`FIRST 2s  > 25ms: ${result.first2_over25}    > 33ms: ${result.first2_over33}`)
console.log(`AFTER 2s  > 25ms: ${result.after2_over25}    > 33ms: ${result.after2_over33}`)
console.log("spikes (>25ms):", JSON.stringify(result.spikes))
console.log("=== __wpSceneStats() right after walk ===")
console.log(JSON.stringify(result.stats, null, 2))
console.log("=== __wpSceneStats() after broad multi-direction sweep ===")
console.log(JSON.stringify(sweepStats, null, 2))
console.log(`pageerrors: ${pageErrors.length}`)
for (const e of pageErrors) console.log("  ERR:", e)
console.log(`screenshot: /tmp/wp-stage3.png`)

await browser.close()
