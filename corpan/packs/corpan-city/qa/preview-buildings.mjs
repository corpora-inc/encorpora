/**
 * Premium-buildings preview (WebKit). Boots qa/buildings.html — a street of one
 * building per kind + a seed-chosen back row under the warm atmosphere — orbits
 * the camera to several angles, screenshots each, and reports scene stats
 * (draw calls / fps / mesh+material+texture counts) so we can confirm the
 * draw-call budget holds for a full plaza.
 *
 * Screenshots: /tmp/wp-buildings-{front,three-quarter,side,low,top}.png
 *
 * Usage: node qa/preview-buildings.mjs [http://localhost:5174]
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const url = `${base}/qa/buildings.html`
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`)
})

await page.goto(url, { waitUntil: "load" })
await page.waitForFunction(() => !!window.__wpBuildings, { timeout: 8000 })
// let textures bake + a few frames settle
await page.waitForTimeout(1500)

const D2R = Math.PI / 180
const shots = [
  { name: "front", alpha: -90 * D2R, beta: 72 * D2R, radius: 26 },
  { name: "three-quarter", alpha: -52 * D2R, beta: 64 * D2R, radius: 24 },
  { name: "side", alpha: 0 * D2R, beta: 70 * D2R, radius: 24 },
  { name: "low", alpha: -70 * D2R, beta: 84 * D2R, radius: 18 },
  { name: "top", alpha: -90 * D2R, beta: 40 * D2R, radius: 30 },
]

for (const s of shots) {
  await page.evaluate(([a, b, r]) => window.__wpBuildings.setAngle(a, b, r), [s.alpha, s.beta, s.radius])
  await page.waitForTimeout(450)
  await page.screenshot({ path: `/tmp/wp-buildings-${s.name}.png` })
  console.log(`shot: /tmp/wp-buildings-${s.name}.png`)
}

// settle then sample fps over ~1s
await page.waitForTimeout(1000)
const stats = await page.evaluate(() => window.__wpBuildings.stats())
console.log("\nscene stats:", JSON.stringify(stats, null, 2))

const ok = []
const assert = (name, cond, detail = "") => {
  ok.push(cond)
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}
assert("no page errors", errors.length === 0, errors.join(" | "))
assert("buildings rendered", stats.activeMeshes > stats.buildings, `active=${stats.activeMeshes} for ${stats.buildings} blockers`)
// MergeMeshes(multiMultiMaterials) makes one MultiMaterial per building, plus a
// shared pool of StandardMaterials + facade textures. This preview is a STRESS
// case — every building is a different kind/footprint, so texture sharing is
// minimal; a real town (many houses) shares far more. Budget generously.
assert("material pool bounded (shared standards + per-building multimat)", stats.materials <= stats.buildings * 3 + 12, `materials=${stats.materials}`)
assert("texture pool is small (shared)", stats.textures <= 40, `textures=${stats.textures}`)
assert("fps healthy", stats.fps >= 50, `fps=${stats.fps}`)
assert("draw calls modest", stats.drawCalls < 0 || stats.drawCalls <= stats.buildings * 4 + 12, `draws=${stats.drawCalls}`)

console.log("\npageerrors:", errors.length ? errors : "none")
const failed = ok.filter((x) => !x).length
console.log(`\n${ok.length - failed}/${ok.length} checks passed`)
await browser.close()
process.exit(failed ? 1 : 0)
