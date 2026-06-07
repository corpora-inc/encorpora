/**
 * People harness — verifies the Wave-2 living-character foundations on webkit:
 *   • a plaza full of DISTINCT wandering people
 *   • planted, non-drifting contact shadows from multiple camera angles + while moving
 *   • autonomous wander (agents actually change position over time)
 *   • no overlaps (separation steering)
 *   • 60fps with ~34 agents (perf HUD)
 * Screenshots → /tmp/wp-people-*.png
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174/qa/people.html"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text())
})

await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2500) // world + crowd build + first wander

// --- 1. overview: a plaza full of distinct people ---
await page.screenshot({ path: "/tmp/wp-people-1-overview.png" })

// --- capture agent positions twice to prove autonomous wander ---
const posA = await page.evaluate(() => window.__wpPeople?.agentPositions() ?? [])
await page.waitForTimeout(1800)
const posB = await page.evaluate(() => window.__wpPeople?.agentPositions() ?? [])

let moved = 0
let maxMove = 0
for (let i = 0; i < posA.length; i++) {
  const a = posA[i]
  const b = posB.find((p) => p.id === a.id) ?? a
  const d = Math.hypot(b.x - a.x, b.z - a.z)
  if (d > 0.2) moved++
  maxMove = Math.max(maxMove, d)
}

// min pairwise distance (separation check) at posB
let minPair = Infinity
for (let i = 0; i < posB.length; i++)
  for (let j = i + 1; j < posB.length; j++) {
    const d = Math.hypot(posB[i].x - posB[j].x, posB[i].z - posB[j].z)
    if (d < minPair) minPair = d
  }

// --- 2. orbit the camera (shadows must stay welded to feet) ---
await page.mouse.move(800, 400)
await page.mouse.down()
for (let i = 0; i < 16; i++) await page.mouse.move(800 + i * 12, 400)
await page.mouse.up()
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-people-2-orbit.png" })

// --- 3. walk into the crowd (moving shadows + greet) ---
await page.keyboard.down("w")
await page.waitForTimeout(1400)
await page.keyboard.up("w")
await page.waitForTimeout(300)
await page.screenshot({ path: "/tmp/wp-people-3-walk.png" })

// --- 4. close approach to trigger a greet, then engage ---
await page.keyboard.down("w")
await page.waitForTimeout(700)
await page.keyboard.up("w")
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-people-4-greet.png" })
await page.keyboard.press("e")
await page.waitForTimeout(200)
const engaged = await page.evaluate(() => window.__wpEngaged ?? null)

// --- perf ---
const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(no hud)")
const fps = Number((hud.match(/fps (\d+)/) ?? [])[1] ?? 0)

console.log("=== PEOPLE QA ===")
console.log("agents:", posA.length)
console.log(`wandered (>0.2u in 1.8s): ${moved}/${posA.length}  maxMove ${maxMove.toFixed(2)}u`)
console.log("min pairwise distance:", minPair.toFixed(2), "u")
console.log("engaged on approach:", engaged)
console.log("PERF:\n" + hud)
console.log("page errors:", errors.length ? errors.slice(0, 6) : "none")

const ok =
  posA.length >= 30 &&
  moved >= posA.length * 0.4 &&
  minPair > 0.8 &&
  fps >= 55 &&
  errors.length === 0
console.log(ok ? "RESULT: PASS" : "RESULT: CHECK (see above)")

await browser.close()
