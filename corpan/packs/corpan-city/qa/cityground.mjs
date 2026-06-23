/**
 * Screenshot the STREAMING city ground (qa/cityground.html → mountCity →
 * cityGround.ts) in WebKit (≈ WKWebView) to reproduce/verify the embedded
 * "gray ground / no roads" bug. Boots its own vite, parks an over-the-shoulder
 * camera at the plaza + a top-down, saves /tmp/wp-ground-*.png, and samples a
 * centre-strip pixel histogram so the result is machine-checkable (a textured
 * cobble/flagstone ground has colour VARIANCE; a flat gray plane does not).
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_GROUND_PORT ?? 5194)
const BASE = `http://localhost:${PORT}`

const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  cwd: packDir,
  stdio: "inherit",
})
const cleanup = () => {
  try { vite.kill("SIGTERM") } catch {}
}
process.on("exit", cleanup)

await sleep(2500)

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()) })

await page.goto(`${BASE}/qa/cityground.html`, { waitUntil: "load" })
// let the streaming build warm so the plaza chunk (with roads) is built.
await page.waitForTimeout(4000)

const groundMeshes = await page.evaluate(() => window.__wpGround.groundMeshCount())
const warmedMs = await page.evaluate(() => window.__wpGround.warmedMs())
const diag = await page.evaluate(() => window.__wpGround.diag())
console.log("DIAG:", JSON.stringify(diag, null, 2))

// over-the-shoulder across the plaza (same framing as the composition harness's
// plaza shot, which DOES show roads) — the cobble streets + flagstone disc are here.
await page.evaluate(() => window.__wpGround.setView(Math.PI * 0.62, 1.46, 24, 0, 0))
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-ground-plaza.png" })

// CLOSE-UP straight DOWN at a small ground patch near origin — ground fills the
// frame, minification can't wash out the texture, so a textured ground MUST show
// cobble/flagstone. (Park camPos here first so the origin chunk stays enabled.)
await page.evaluate(() => window.__wpGround.lookDownAt(0, 0, 16))
await page.waitForTimeout(1500)
await page.screenshot({ path: "/tmp/wp-ground-closeup.png" })
const cstat = await page.evaluate(() => {
  const cv = document.getElementById("wp-canvas")
  const oc = document.createElement("canvas"); oc.width = 200; oc.height = 200
  const ctx = oc.getContext("2d")
  ctx.drawImage(cv, 540, 300, 200, 200, 0, 0, 200, 200) // dead centre
  const d = ctx.getImageData(0, 0, 200, 200).data
  let n = 0, s = 0, s2 = 0
  for (let i = 0; i < d.length; i += 4) { const l = d[i]; s += l; s2 += l * l; n++ }
  const mean = s / n
  return { mean: Math.round(mean), std: Math.round(Math.sqrt(s2 / n - mean * mean)) }
})
console.log("CLOSEUP centre — mean:", cstat.mean, " std:", cstat.std, "(textured ground → std > 8)")

// ── RIVERWALK + WATER (#30/#31) ───────────────────────────────────────────
// Park the camera at the waterfront so the river chunks build, then frame the
// promenade over-the-shoulder + a top-down of the bank/water boundary.
const water = await page.evaluate(() => window.__wpGround.water())
console.log("WATER:", JSON.stringify(water))
const bankMidZ = (water.bankZ + water.waterZ) / 2
// stand on the riverwalk and look out across the water (low beta = horizon view).
await page.evaluate((z) => window.__wpGround.setView(Math.PI / 2, 1.32, 40, 30, z - 22), bankMidZ)
await page.waitForTimeout(3500) // let the waterfront chunks stream + build
await page.evaluate((z) => window.__wpGround.setView(Math.PI / 2, 1.32, 40, 30, z - 22), bankMidZ)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-ground-riverwalk.png" })
// top-down on the bank/water boundary: land (stone) below, blue river above.
await page.evaluate((z) => window.__wpGround.lookDownAt(0, z, 70), water.bankZ)
await page.waitForTimeout(1500)
await page.screenshot({ path: "/tmp/wp-ground-bank.png" })

// PLACEMENT physics (#30): is the open water blocked for spawners?
const place = await page.evaluate(() => window.__wpGround.waterPlacement())
const waterOk = place.waterProbes > 0 && place.waterBlocked === place.waterProbes
const bridgeOk = place.bridgeOpen > 0
const bankOk = place.bankProbes > 0 && place.bankWalkable / place.bankProbes > 0.7
console.log("\n================ WATER PLACEMENT (#30) ================")
console.log(`open-water probes blocked: ${place.waterBlocked}/${place.waterProbes}  ${waterOk ? "PASS (nobody on the river)" : "FAIL"}`)
console.log(`bridge corridor open:      ${place.bridgeOpen}/${place.bridgeProbes}   ${bridgeOk ? "PASS (crossable)" : "FAIL"}`)
console.log(`riverwalk band walkable:   ${place.bankWalkable}/${place.bankProbes}   ${bankOk ? "PASS (real promenade)" : "FAIL"}`)

// ── CRAFTED BOUNDARY (#32): far bank + walls ──────────────────────────────
// Look across the river toward the FAR BANK (the city the bridge arrives at),
// standing near the bridge mouth on the near bank facing +Z (alpha = -PI/2).
await page.evaluate((w) => window.__wpGround.setView(-Math.PI / 2, 1.28, 70, w.bridgeX, w.bankZ - 18), water)
await page.waitForTimeout(4000) // let the river + far-bank chunks stream
await page.evaluate((w) => window.__wpGround.setView(-Math.PI / 2, 1.28, 70, w.bridgeX, w.bankZ - 18), water)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-ground-farbank.png" })
// top-down on the river BAND: near bank → blue river → far bank → sea wall.
await page.evaluate((w) => window.__wpGround.lookDownAt(w.bridgeX, (w.waterZ + w.farPromZ) / 2, 120), water)
await page.waitForTimeout(1500)
await page.screenshot({ path: "/tmp/wp-ground-riverband.png" })
// look along the SOUTH wall (stand inside, face -Z toward the rampart).
await page.evaluate(() => window.__wpGround.setView(Math.PI / 2, 1.30, 60, 60, -300))
await page.waitForTimeout(3500)
await page.evaluate(() => window.__wpGround.setView(Math.PI / 2, 1.30, 60, 60, -300))
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-ground-wall.png" })

const bp = await page.evaluate(() => window.__wpGround.boundaryPlacement())
const wallOk = bp.wallProbes > 0 && bp.wallBlocked === bp.wallProbes
const gatesOk = bp.gates === 0 || bp.gatesOpen === bp.gates
console.log("\n================ CRAFTED BOUNDARY (#32) ================")
console.log(`rampart off-gate blocked:  ${bp.wallBlocked}/${bp.wallProbes}  ${wallOk ? "PASS (designed wall, not fog)" : "FAIL"}`)
console.log(`gates walkable:            ${bp.gatesOpen}/${bp.gates}   ${gatesOk ? "PASS (passable gateways)" : "FAIL"}`)
console.log(`bridge reaches far bank:   ${bp.farBankReachable ? "PASS (arrives at more city)" : "FAIL"}`)

// top-down over the plaza/streets.
await page.evaluate(() => window.__wpGround.setView(Math.PI / 2, 0.02, 90, 0, 0))
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-ground-topdown.png" })

// Pixel variance probe on the plaza shot's lower-centre (the ground band): a
// textured ground has real colour spread; a flat gray plane is ~uniform.
const stats = await page.evaluate(() => {
  const cv = document.getElementById("wp-canvas")
  const oc = document.createElement("canvas")
  const sx = 340, sy = 560, sw = 600, sh = 200 // lower ground band (foreground street)
  oc.width = sw; oc.height = sh
  const ctx = oc.getContext("2d")
  ctx.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh)
  const d = ctx.getImageData(0, 0, sw, sh).data
  let n = 0, sum = 0, sum2 = 0
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    sum += lum; sum2 += lum * lum; n++
  }
  const mean = sum / n
  const variance = sum2 / n - mean * mean
  return { mean: Math.round(mean), std: Math.round(Math.sqrt(variance)) }
})

console.log("\n================ STREAMING GROUND ================")
console.log("ground meshes built:", groundMeshes, " warmed:", warmedMs, "ms")
console.log("plaza ground band — mean lum:", stats.mean, " std:", stats.std)
console.log("(a textured cobble/flagstone ground → std clearly > ~8; a flat gray plane → std ~0–3)")
console.log("page errors:", errors.length ? errors : "none")
console.log("shots: /tmp/wp-ground-plaza.png  /tmp/wp-ground-topdown.png")

await browser.close()
cleanup()
process.exit(0)
