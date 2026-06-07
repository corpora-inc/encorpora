/**
 * Screenshot the WORLD-EDGE dressing (qa/edge.html → harborBoats over the real
 * streaming river band) in WebKit (≈ WKWebView), task #32's visual half. Boots
 * its own vite, frames the harbour from a hero over-the-water angle + a low
 * grazing angle along the quay + a top-down, saving /tmp/wp-edge-*.png.
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_EDGE_PORT ?? 5198)
const BASE = `http://localhost:${PORT}`

const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: packDir, stdio: "inherit" })
const cleanup = () => { try { vite.kill("SIGTERM") } catch {} }
process.on("exit", cleanup)
await sleep(2800)

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()) })

await page.goto(`${BASE}/qa/edge.html`, { waitUntil: "load" })
await page.waitForTimeout(5500) // warm the streaming waterfront chunks

const diag = await page.evaluate(() => window.__wpEdge.diag())
console.log("DIAG:", JSON.stringify(diag, null, 2))
const w = diag.water

// pick a real near-quay boat instance to frame on (positions vary by seed).
const boat = await page.evaluate(() => {
  const scene = window.__wpScene
  const bm = scene.meshes.filter((m) => m.name.includes("wp-boats") && m.thinInstanceCount > 0)
  const pts = []
  for (const m of bm) {
    const mats = m.thinInstanceGetWorldMatrices ? m.thinInstanceGetWorldMatrices() : []
    for (const x of mats) pts.push([Math.round(x.m[12]), Math.round(x.m[14])])
  }
  const near = pts.filter((p) => p[1] < 330)
  near.sort((a, b) => a[0] - b[0])
  return near[Math.floor(near.length / 2)] || [-180, 313]
})

// CLOSE: a tight three-quarter on a moored boat (hull + cabin + mast + sail).
await page.evaluate(([x, z]) => window.__wpEdge.setView(-Math.PI * 0.7, 1.02, 7, x, z), boat)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-close.png" })

// CLUSTER: from the water side, a moored boat against the quay + city behind.
await page.evaluate(([x, z]) => window.__wpEdge.setView(Math.PI * 0.5, 1.12, 22, x, z), boat)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-cluster.png" })

// ACROSS: from the near riverwalk, across the river at the far bank + skyline.
await page.evaluate((w) => window.__wpEdge.setView(Math.PI / 2, 1.5, 60, 0, w.farPromZ + 20), w)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-across.png" })

// SKYLINE (clear-air proof): the distant-city silhouette without the fog dome.
await page.goto(`${BASE}/qa/edge.html?noatmo=1`, { waitUntil: "load" })
await page.waitForTimeout(5000)
await page.evaluate((w) => window.__wpEdge.setView(Math.PI / 2, 1.5, 70, 0, w.farPromZ + 30), w)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-skyline.png" })

console.log("\n================ WORLD-EDGE (boats) ================")
console.log("river band z:", w.waterZ, "→", w.farBankZ, " bridgeX:", w.bridgeX)
console.log("boat meshes:", diag.boatMeshes, " thin counts:", JSON.stringify(diag.thinCounts),
  " total base verts:", diag.totalVerts)
console.log("page errors:", errors.filter((e) => !e.includes("WebSocket")).length
  ? errors.filter((e) => !e.includes("WebSocket")) : "none (WebSocket HMR noise ignored)")
console.log("framed boat at:", JSON.stringify(boat))
console.log("shots: /tmp/wp-edge-{close,cluster,across,skyline}.png")

await browser.close()
cleanup()
process.exit(0)
