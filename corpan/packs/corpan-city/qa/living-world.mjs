/**
 * Living-world establishing shots: boots the harness, parks cinematic cameras,
 * and saves screenshots a human can judge. NOT a flat pixel-variance gate — these
 * are for READING: "does it look like a rich, lived-in town?"
 *
 * Shots:
 *   wp-lw-plaza-wide   — wide hero of the plaza + fountain, the player's first view
 *   wp-lw-market       — a walk-through angle past the market square (stalls/carts)
 *   wp-lw-sightline    — a low landmark sightline down a street toward the market hall
 *   wp-lw-harbor       — the waterfront / harbor dressing
 *   wp-lw-aerial       — a 3/4 aerial so silhouette variety + density read at once
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_LW_PORT ?? 5183)
const BASE = `http://localhost:${PORT}`
const TAG = process.env.WP_LW_TAG ?? "" // e.g. "-before"

const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: packDir,
  stdio: "inherit",
})
const cleanup = () => {
  try { vite.kill("SIGTERM") } catch {}
}
process.on("exit", cleanup)
await sleep(2800)

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()) })

await page.goto(`${BASE}/qa/living-world.html`, { waitUntil: "load" })
await page.waitForTimeout(4500)

// wait for the harness hooks to exist (WebKit GPU init can lag a beat).
async function waitHooks() {
  for (let i = 0; i < 20; i++) {
    const ok = await page.evaluate(() => !!window.__wpLW).catch(() => false)
    if (ok) return true
    await page.waitForTimeout(500)
  }
  return false
}
if (!(await waitHooks())) { console.log("HARNESS NEVER MOUNTED:", errors.slice(0, 8)); await browser.close(); cleanup(); process.exit(1) }

const anchors = await page.evaluate(() => window.__wpLW.anchors())
console.log("ANCHORS:", JSON.stringify(anchors))
const A = Object.fromEntries(anchors.map((a) => [a.id, a]))
const market = A.market ?? { x: 0, z: -30 }
const harbor = A.harbor ?? { x: 0, z: 100 }

async function shot(name, fn, arg, settle = 2600) {
  await page.evaluate(fn, arg)
  await page.waitForTimeout(settle)
  await page.evaluate(fn, arg) // re-aim after chunks streamed in (camPos moved them resident)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `/tmp/wp-lw-${name}${TAG}.png` })
  const d = await page.evaluate(() => window.__wpLW.density())
  console.log(`  ${name}: total=${d.total} buildings=${d.buildings} props=${d.props} ground=${d.ground} species=${JSON.stringify(d.propsBySpecies)}`)
}

// 1) WIDE plaza hero — eye-level, looking across the fountain into town. A touch
//    higher pitch so the buildings ringing the plaza read, not just the floor.
await shot("plaza-wide", () => window.__wpLW.setView(Math.PI * 0.62, 1.18, 34, 0, 1.4, 8, 0.84), null, 3400)

// 2) MARKET walk-through — stand a few metres off the market, low + close.
await shot("market", (m) => window.__wpLW.setView(Math.PI * 0.5, 1.30, 24, m.x, 1.2, m.z + 20, 0.9), market, 3600)
await shot("market2", (m) => window.__wpLW.setView(Math.PI * 0.56, 1.26, 22, m.x, 1.2, m.z + 16, 0.92), market, 3600)

// 3) LANDMARK sightline — low, down a street toward the market hall.
await shot("sightline", (m) => window.__wpLW.setView(-Math.PI / 2, 1.40, 50, m.x, 1.0, m.z - 30, 0.7), market, 3600)

// 4) STREET — a residential/downtown street near the plaza (trees + furniture).
await shot("street", () => window.__wpLW.setView(Math.PI * 0.3, 1.28, 30, 60, 1.2, 40, 0.85), null, 3400)

// 5) TOWER sightline — frame the hero clock tower (placed at -25,-21) from the
//    plaza so it reads against the skyline.
await shot("tower", () => window.__wpLW.setView(Math.PI * 0.30, 1.18, 38, -10, 2, -8, 0.8), null, 3400)

// 6) AERIAL 3/4 — silhouette variety + density in one read (kept near origin).
await shot("aerial", () => window.__wpLW.setView(Math.PI * 0.62, 0.85, 110, 20, 0, 0, 0.72), null, 3000)

void harbor

console.log("\nshots saved to /tmp/wp-lw-*" + TAG + ".png")
console.log("page errors:", errors.length ? errors.slice(0, 6) : "none")

await browser.close()
cleanup()
process.exit(0)
