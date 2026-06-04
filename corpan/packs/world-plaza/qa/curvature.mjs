/**
 * CURVATURE SPIKE — before/after WebKit proof (#36).
 *
 * Boots the real streaming city + atmosphere + vista + ambient paper-people with
 * the world-curvature plugin layered on (qa/curvature.html → curvature-mount.ts),
 * then for a set of camera poses captures a matched pair:
 *   FLAT  (curvature 0  — today's hard pop-in baseline)
 *   BENT  (curvature default — distant buildings crest the horizon)
 *
 * Also prints the DE-RISK GATE: for the farthest ambient billboard, the world-Y
 * drop the shader applies to its FEET vs the ground under it — equal ⇒ the
 * paper-person rides the curve (doesn't float). And the engine fps under the bend.
 *
 * WebKit ≈ the macOS WKWebView the app ships in. Self-contained: spawns + tears
 * down its own vite on a unique port. Saves /tmp/wp-curve-*.png.
 *
 * Run:  node qa/curvature.mjs       (reuse a running dev: WP_CURVE_REUSE=1)
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const PORT = Number(process.env.WP_CURVE_PORT ?? 5193)
const BASE = process.env.WP_CURVE_BASE ?? `http://localhost:${PORT}`
const REUSE = process.env.WP_CURVE_REUSE === "1"

const procs = []
const spawnProc = (cmd, args, name) => {
  const p = spawn(cmd, args, { cwd: packDir, stdio: "pipe", detached: true })
  p.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`))
  p.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`))
  procs.push(p)
  return p
}
const portOpen = (port) =>
  new Promise((res) => {
    let pending = 2
    let opened = false
    const done = (ok) => {
      if (ok) opened = true
      if (--pending === 0) res(opened)
    }
    for (const host of ["127.0.0.1", "::1"]) {
      const s = net.connect(port, host)
      s.once("connect", () => { s.destroy(); done(true) })
      s.once("error", () => done(false))
    }
  })
const waitPort = async (port, label, timeoutMs = 30000) => {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return true
    await sleep(300)
  }
  throw new Error(`timed out waiting for ${label} on :${port}`)
}
const cleanup = () => {
  for (const p of procs) {
    try { process.kill(-p.pid, "SIGKILL") } catch {}
    try { p.kill("SIGKILL") } catch {}
  }
}
process.on("exit", cleanup)
process.on("SIGINT", () => { cleanup(); process.exit(1) })

let exitCode = 0
let browser
try {
  if (!REUSE) {
    console.log(`→ starting vite dev on :${PORT}…`)
    spawnProc("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], "vite")
    await waitPort(PORT, "vite")
    await sleep(1500)
  } else {
    console.log(`→ reusing vite at ${BASE}`)
  }

  browser = await webkit.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(`pageerror: ${e}`))
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`) })

  console.log("→ loading curvature harness…")
  await page.goto(`${BASE}/qa/curvature.html`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpCurve && window.__wpCurve.ready, { timeout: 20000 })
  await page.waitForTimeout(1800)

  const call = (fn, ...args) => page.evaluate(([f, a]) => window.__wpCurve[f](...a), [fn, args])

  // Warm the whole city in (time-sliced streaming) so the far field exists to crest.
  console.log("→ warming the city in…")
  await call("place", 0, 12, 0)        // on +Z facing -Z (toward Mt. Fuji)
  await call("warm", 16000)            // ~15-20s of build, run fast headless
  await call("settle", 80)
  await page.waitForTimeout(300)

  // A matched before/after at one pose: shoot FLAT (0) then BENT (default).
  const pair = async (label, x, z, yaw) => {
    await call("place", x, z, yaw)
    await call("setCurvature", 0)      // FLAT — today's baseline
    await call("settle", 70)
    await page.waitForTimeout(150)
    await page.screenshot({ path: `/tmp/wp-curve-${label}-flat.png` })
    await call("setCurvature", -0.0016) // BENT — the reveal
    await call("settle", 12)
    await page.waitForTimeout(120)
    await page.screenshot({ path: `/tmp/wp-curve-${label}-bent.png` })
  }

  console.log("→ pair: cruising toward Mount Fuji (deep avenue)…")
  await pair("avenue", 0, 12, 0)

  console.log("→ pair: from farther back (more far-field to crest)…")
  await pair("deep", 0, 60, 0)

  console.log("→ pair: looking across the city (yaw 90°)…")
  await pair("cross", 0, 12, Math.PI / 2)

  // A curvature SWEEP at the avenue pose so the owner can pick the strength.
  console.log("→ sweep: curvature strength ladder…")
  await call("place", 0, 24, 0)
  for (const c of [0, -0.0008, -0.0016, -0.0026, -0.004]) {
    await call("setCurvature", c)
    await call("settle", c === 0 ? 60 : 14)
    await page.waitForTimeout(120)
    const tag = String(c).replace(/[.-]/g, "")
    await page.screenshot({ path: `/tmp/wp-curve-sweep-${tag || "0"}.png` })
  }

  // DE-RISK GATE readout at default strength.
  await call("setCurvature", -0.0016)
  await call("settle", 14)
  const gate = await call("gate")
  const fps = await call("fps")

  console.log("\n================ CURVATURE SPIKE RESULTS ================")
  console.log("DE-RISK GATE (do billboards ride the curve?):")
  console.log(JSON.stringify(gate, null, 2))
  console.log(
    `\n  → billboard feet drop ${gate.billboardFeetDrop} vs ground drop ${gate.groundDropUnderBillboard}` +
      ` @ ${gate.farthestBillboard ? gate.farthestBillboard.dist + "u" : "n/a"}` +
      `  ⇒ ${gate.billboardFeetDrop === gate.groundDropUnderBillboard ? "RIDES THE CURVE ✓" : "FLOATS ✗"}`,
  )
  console.log(`\nPERF: engine fps under the bend ≈ ${Math.round(fps)}`)
  console.log("CONSOLE/PAGE ERRORS:", errs.length ? errs : "none")
  console.log("\nSHOTS in /tmp:")
  console.log("  before/after: wp-curve-{avenue,deep,cross}-{flat,bent}.png")
  console.log("  strength sweep: wp-curve-sweep-*.png")
  console.log("========================================================\n")

  if (errs.length) exitCode = 1
} catch (e) {
  console.error("CURVATURE SPIKE FAILED:", e)
  exitCode = 1
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
