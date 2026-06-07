/**
 * SCENE-DIVERGENCE PROOF — Antigua 1770 ⇄ Tokyo 2050 over ONE shared topology.
 *
 * Boots a fresh vite dev server on a free port, loads qa/divergence.html (the
 * REAL stylized world look + atmosphere driven from a Scene), parks a low
 * over-the-shoulder HERO camera, and captures the SAME camera position rendered
 * as warm Antigua daylight AND neon Tokyo night — proving divergent buildings
 * (buildingStyle) + palette + sky/landmark with IDENTICAL layout/collisions.
 *
 * It also captures a straight-down top-down of each scene: the building
 * FOOTPRINTS must be pixel-for-pixel identical in position (only the skin
 * differs), which is the visual proof that the collision topology never moved.
 *
 * Saves:
 *   /tmp/wp-diverge-antigua.png   (hero, warm day)
 *   /tmp/wp-diverge-tokyo.png     (hero, neon night)
 *   /tmp/wp-diverge-antigua-top.png  (top-down footprints)
 *   /tmp/wp-diverge-tokyo-top.png    (top-down footprints — same positions)
 *
 *   Run:  node qa/divergence.mjs
 *   Env:  WP_DIV_REUSE=1  reuse a running vite (WP_DIV_BASE=http://…:PORT)
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const PORT = Number(process.env.WP_DIV_PORT ?? 5193)
const BASE = process.env.WP_DIV_BASE ?? `http://localhost:${PORT}`
const REUSE = process.env.WP_DIV_REUSE === "1"

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

// mean per-channel colour over the whole canvas → quick day/night divergence check.
const meanColor = (page) =>
  page.evaluate(() => {
    const cv = document.getElementById("wp-canvas")
    const oc = document.createElement("canvas")
    oc.width = 160
    oc.height = 100
    const ctx = oc.getContext("2d")
    ctx.drawImage(cv, 0, 0, oc.width, oc.height)
    const d = ctx.getImageData(0, 0, oc.width, oc.height).data
    let r = 0, g = 0, b = 0
    const n = d.length / 4
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    return [r / n, g / n, b / n]
  })

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

  console.log("→ loading divergence harness…")
  // Cold vite re-optimizes deps mid-load on first hit → reload-until-ready.
  let ready = false
  for (let attempt = 0; attempt < 4 && !ready; attempt++) {
    await page.goto(`${BASE}/qa/divergence.html`, { waitUntil: "load" })
    try {
      await page.waitForFunction(() => window.__wpDiv && window.__wpDiv.ready, { timeout: 12000 })
      ready = true
    } catch {
      console.log(`  …not ready (attempt ${attempt + 1}), reloading after settle`)
      await sleep(1500)
    }
  }
  if (!ready) throw new Error("harness never reached __wpDiv.ready")
  await page.waitForTimeout(1800)

  const R = () => page.evaluate(() => window.__wpDiv.render())
  const flip = (key) => page.evaluate((k) => window.__wpDiv.set(k), key)
  const hero = () => page.evaluate(() => window.__wpDiv.setHero())
  const top = () => page.evaluate(() => window.__wpDiv.setTopDown())

  // ---- HERO money shot, both scenes, SAME camera ----
  console.log("→ HERO antigua (warm 1770 day)…")
  await flip("antigua")
  await hero()
  await R(); await page.waitForTimeout(400); await R()
  const antiguaMean = await meanColor(page)
  await page.screenshot({ path: "/tmp/wp-diverge-antigua.png" })

  console.log("→ HERO tokyo (neon 2050 night) — SAME camera…")
  await flip("tokyo")
  await R(); await page.waitForTimeout(400); await R()
  const tokyoMean = await meanColor(page)
  await page.screenshot({ path: "/tmp/wp-diverge-tokyo.png" })

  // ---- TOP-DOWN footprints, both scenes (identical positions) ----
  console.log("→ TOP-DOWN antigua (footprints)…")
  await flip("antigua")
  await top()
  await R(); await page.waitForTimeout(300); await R()
  await page.screenshot({ path: "/tmp/wp-diverge-antigua-top.png" })

  console.log("→ TOP-DOWN tokyo (footprints — same positions)…")
  await flip("tokyo")
  await R(); await page.waitForTimeout(300); await R()
  await page.screenshot({ path: "/tmp/wp-diverge-tokyo-top.png" })

  // ---- divergence assertion: night must be markedly darker + bluer than day ----
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
  const dayL = lum(antiguaMean)
  const nightL = lum(tokyoMean)
  const dayWarm = antiguaMean[0] - antiguaMean[2] // R−B: warm > 0
  const nightCool = tokyoMean[2] - tokyoMean[0] // B−R: cool > 0

  console.log("\n================ DIVERGENCE RESULTS ================")
  console.log(`antigua mean RGB : ${antiguaMean.map((v) => v.toFixed(0)).join(",")}  (lum ${dayL.toFixed(0)}, warmth R−B ${dayWarm.toFixed(0)})`)
  console.log(`tokyo   mean RGB : ${tokyoMean.map((v) => v.toFixed(0)).join(",")}  (lum ${nightL.toFixed(0)}, coolness B−R ${nightCool.toFixed(0)})`)
  console.log("screenshots     : /tmp/wp-diverge-antigua.png, -tokyo.png, -antigua-top.png, -tokyo-top.png")
  console.log("page errors     :", errs.length ? errs.slice(0, 5) : "none")

  const divergent = nightL < dayL - 20 && dayWarm > 0 && nightCool > 0
  const pass = divergent && errs.length === 0
  console.log("\n" + (pass ? "PASS: scenes diverge (night darker+cooler, day warmer) over ONE topology" : "FAIL: scenes did not diverge as expected"))
  console.log("====================================================")
  exitCode = pass ? 0 : 1
} catch (e) {
  console.error("DIVERGENCE ERROR:", e)
  exitCode = 2
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
