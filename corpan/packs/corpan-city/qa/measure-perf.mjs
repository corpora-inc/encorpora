/**
 * measure-perf — headless draw-call + frame-phase profiler sample.
 *
 * Boots the standalone world in WebKit, warms the neighbourhood by walking a
 * loop, then samples the in-engine profiler hooks (`__wpDraws`/`__wpPhases`/
 * `__wpActive`) several times and prints medians. This is the BEFORE/AFTER ruler
 * for the perf work — run it on the baseline, make a change, run it again.
 *
 * Usage: node qa/measure-perf.mjs [url]
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
})
const logs = []
page.on("console", (m) => {
  const t = m.text()
  if (t.includes("near chunks") || t.startsWith("[wp")) logs.push(t)
})
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2500)
// Dismiss the entry surfaces: language chooser (pick first) then the welcome CTA.
await page.click(".wp-entry-lang", { timeout: 1500 }).catch(() => {})
await page.click(".wp-entry-btn", { timeout: 4000 }).catch(() => {})
// Wait for the engine + profiler hooks to come up.
await page
  .waitForFunction(() => typeof window.__wpPhases === "function", { timeout: 15000 })
  .catch(() => {})
await page.waitForTimeout(800)

// Warm the neighbourhood: walk forward + strafe + orbit so the streamer fills in
// a full near-ring (worst case for draws), then let it settle.
const warm = async (key, ms) => {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}
await warm("w", 1600)
await warm("d", 1200)
await warm("s", 1600)
await warm("a", 1200)
await page.waitForTimeout(2500) // let the build queue drain + chunks settle

// Sample the profiler hooks several times; report medians.
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
const draws = []
const frameMs = []
const renderMs = []
const activeEvalMs = []
const meshesActive = []
const meshesTotal = []
let lastActive = null
let lastPhases = null
for (let i = 0; i < 12; i++) {
  const s = await page.evaluate(() => {
    const w = window
    const ph = w.__wpPhases ? w.__wpPhases() : null
    const ac = w.__wpActive ? w.__wpActive() : null
    return { ph, ac }
  })
  if (s.ph) {
    draws.push(s.ph.draws)
    frameMs.push(s.ph.frameMs)
    renderMs.push(s.ph.renderMs)
    activeEvalMs.push(s.ph.activeMeshEvalMs)
    meshesActive.push(s.ph.meshesActive)
    meshesTotal.push(s.ph.meshesTotal)
    lastPhases = s.ph
  }
  if (s.ac) lastActive = s.ac
  await page.waitForTimeout(200)
}

const fps = (ms) => (ms > 0 ? (1000 / ms).toFixed(1) : "?")
console.log("\n===== WORLD PLAZA PERF SAMPLE =====")
console.log(`draws        median ${median(draws)}   range ${Math.min(...draws)}–${Math.max(...draws)}`)
console.log(`frameMs      median ${median(frameMs)}  (~${fps(median(frameMs))} fps)`)
console.log(`renderMs     median ${median(renderMs)}`)
console.log(`activeEvalMs median ${median(activeEvalMs)}`)
console.log(`meshesActive median ${median(meshesActive)}`)
console.log(`meshesTotal  median ${median(meshesTotal)}`)
if (lastActive) {
  console.log(`\nactive-mesh breakdown (top): total ${lastActive.activeTotal}`)
  for (const [k, n] of lastActive.top) console.log(`   ${String(n).padStart(4)}  ${k}`)
}
if (logs.length) {
  console.log("\nlast streamer line:")
  console.log("  " + logs[logs.length - 1])
}
console.log("===================================\n")
await browser.close()
