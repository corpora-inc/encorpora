/**
 * Screenshot the RIVERWALK dressing (qa/riverwalk.html → buildRiverwalk over the
 * real streaming city ground) in WebKit (≈ WKWebView), task #31's visual half.
 * Boots its own vite, frames the waterfront from a hero over-the-shoulder angle,
 * a low grazing angle along the quay (the angle the old props failed at), and a
 * top-down, saving /tmp/wp-river-*.png + a colour-variance probe so the result is
 * machine-checkable (a dressed quay has real spread; a flat blue rect does not).
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_RIVER_PORT ?? 5196)
const BASE = `http://localhost:${PORT}`

const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: packDir,
  stdio: "inherit",
})
const cleanup = () => { try { vite.kill("SIGTERM") } catch {} }
process.on("exit", cleanup)
await sleep(2800)

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()) })

await page.goto(`${BASE}/qa/riverwalk.html`, { waitUntil: "load" })
await page.waitForTimeout(4500) // warm the streaming waterfront chunks

const edge = await page.evaluate(() => window.__wpRiver.edge())
const diag = await page.evaluate(() => window.__wpRiver.diag())
console.log("EDGE:", JSON.stringify(edge))
console.log("DIAG:", JSON.stringify(diag, null, 2))
const z = edge.edgeZ

// HERO: a three-quarter showing the balustrade + lamp posts + piers + water.
await page.evaluate((z) => window.__wpRiver.setView(-Math.PI * 0.6, 1.12, 16, 16, z - 3), z)
await page.waitForTimeout(1400)
await page.screenshot({ path: "/tmp/wp-river-hero.png" })

// EYE-LEVEL: stand at the rail looking along it — balusters must read as solid
// turned-stone volumes (the angle the old flat coins/cutouts failed at).
await page.evaluate((z) => window.__wpRiver.setView(-Math.PI / 2, 1.38, 9, 24, z - 1), z)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-river-eye.png" })

// WATER: look out over the rail at the water — depth gradient + ripple + foam.
await page.evaluate((z) => window.__wpRiver.setView(-Math.PI / 2, 0.75, 18, 24, z + 12), z)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-river-water.png" })

// GAP: confirm the rail opens cleanly for the bridge deck at bridgeX.
await page.evaluate((z) => window.__wpRiver.setView(-Math.PI * 0.78, 1.05, 20, 0, z - 3), z)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-river-gap.png" })

// Verify the water texture is actually PAINTED (depth gradient + ripples) by
// sampling the DynamicTexture's backing canvas — a flat wash → std ~0, a
// gradient+ripple → real spread. (Reading the WebGL canvas via drawImage is
// unreliable without preserveDrawingBuffer; the screenshots are the visual proof.)
const waterTex = await page.evaluate(() => {
  const scene = window.__wpScene
  const sheet = scene.meshes.find((m) => m.name.includes("wp-riverwalk") && m.name.endsWith("-water"))
  const tex = sheet && sheet.material && sheet.material.diffuseTexture
  const ctx = tex && tex.getContext && tex.getContext()
  const sz = tex && tex.getSize && tex.getSize()
  if (!ctx || !sz) return { ok: false }
  const d = ctx.getImageData(0, 0, sz.width, sz.height).data
  let n = 0, sum = 0, sum2 = 0
  for (let i = 0; i < d.length; i += 4) { const l = d[i + 1]; sum += l; sum2 += l * l; n++ }
  const mean = sum / n
  return { ok: true, w: sz.width, h: sz.height, mean: Math.round(mean), std: Math.round(Math.sqrt(sum2 / n - mean * mean)) }
})

console.log("\n================ RIVERWALK ================")
console.log("edge z:", edge.edgeZ, " gapX:", edge.gapX, " usingWater seam:", edge.usingWater)
console.log("dressing meshes:", diag.meshes, " thin counts:", JSON.stringify(diag.thinCounts),
  "(lamp/baluster/bollard/pier)")
console.log("water texture:", JSON.stringify(waterTex), "(painted gradient+ripple → std clearly > ~10)")
console.log("page errors:", errors.filter((e) => !e.includes("WebSocket")).length
  ? errors.filter((e) => !e.includes("WebSocket")) : "none (WebSocket HMR noise ignored)")
console.log("shots: /tmp/wp-river-{hero,eye,water,gap}.png")

await browser.close()
cleanup()
process.exit(0)
