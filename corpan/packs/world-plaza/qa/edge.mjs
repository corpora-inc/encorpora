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

// HERO: over the near quay, looking out across the moored boats + river.
await page.evaluate((w) => window.__wpEdge.setView(-Math.PI * 0.5, 1.08, 30, 30, w.waterZ - 6), w)
await page.waitForTimeout(1400)
await page.screenshot({ path: "/tmp/wp-edge-hero.png" })

// CLOSE: a tight three-quarter on a couple of moored boats.
await page.evaluate((w) => window.__wpEdge.setView(-Math.PI * 0.66, 1.1, 12, 40, w.waterZ + 2), w)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-close.png" })

// ACROSS: look across the whole river band — near boats → river → far boats.
await page.evaluate((w) => window.__wpEdge.setView(-Math.PI * 0.5, 0.82, 44, 20, (w.waterZ + w.farBankZ) / 2), w)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-across.png" })

// TOPDOWN: confirm boats line the quays + clear the bridge channel.
await page.evaluate((w) => window.__wpEdge.setView(-Math.PI / 2, 0.02, 150, 0, (w.waterZ + w.farBankZ) / 2), w)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-edge-topdown.png" })

console.log("\n================ WORLD-EDGE (boats) ================")
console.log("river band z:", w.waterZ, "→", w.farBankZ, " bridgeX:", w.bridgeX)
console.log("boat meshes:", diag.boatMeshes, " thin counts:", JSON.stringify(diag.thinCounts),
  " total base verts:", diag.totalVerts)
console.log("page errors:", errors.filter((e) => !e.includes("WebSocket")).length
  ? errors.filter((e) => !e.includes("WebSocket")) : "none (WebSocket HMR noise ignored)")
console.log("shots: /tmp/wp-edge-{hero,close,across,topdown}.png")

await browser.close()
cleanup()
process.exit(0)
