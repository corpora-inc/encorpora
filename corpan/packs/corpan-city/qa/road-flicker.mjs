/**
 * ROAD-FLICKER PROOF — definitive z-fight / shimmer regression test.
 *
 * Boots a fresh vite dev server on a free port, loads qa/road-flicker.html
 * (the REAL stylized world look — buildRoads → single-mesh ground bake), and:
 *
 *   1. Parks an ArcRotateCamera at the WORST grazing angle over a long cobble
 *      street, slowly pans it, grabs consecutive frames straight off the WebGL
 *      canvas, and counts pixels that HARD-FLIP frame-to-frame in a ROAD crop.
 *      Z-fighting = a hard surface swap with (almost) nothing moving → it would
 *      light up this counter. Must be ~0%.
 *   2. Repeats over the FLAGSTONE PLAZA at a grazing skim.
 *   3. Repeats STRAIGHT-DOWN — z-fighting is angle-independent, so a clean
 *      top-down proves the coplanar overlap is GONE, not merely angle-hidden.
 *   4. Screenshots cobble street (grazing) + plaza + top-down + walking view.
 *
 * Self-contained: spawns + tears down vite itself. Saves /tmp/wp-road-*.png.
 *   Run:  node qa/road-flicker.mjs
 *   Env:  WP_ROAD_REUSE=1   reuse a running vite (WP_ROAD_BASE=http://…:PORT)
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const PORT = Number(process.env.WP_ROAD_PORT ?? 5183)
const BASE = process.env.WP_ROAD_BASE ?? `http://localhost:${PORT}`
const REUSE = process.env.WP_ROAD_REUSE === "1"

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

// crop a region of the canvas → raw RGBA array (read in-page off the GL canvas).
const grabCrop = (page, sx, sy, sw, sh) =>
  page.evaluate(
    ([sx, sy, sw, sh]) => {
      const cv = document.getElementById("wp-canvas")
      const oc = document.createElement("canvas")
      oc.width = sw
      oc.height = sh
      const ctx = oc.getContext("2d")
      ctx.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh)
      return Array.from(ctx.getImageData(0, 0, sw, sh).data)
    },
    [sx, sy, sw, sh],
  )

// Count hard luminance flips between two frames (z-fight = abrupt surface swap).
function hardFlips(a, b, thresh = 60) {
  const n = a.length / 4
  let c = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const la = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]
    const lb = 0.3 * b[i] + 0.59 * b[i + 1] + 0.11 * b[i + 2]
    if (Math.abs(la - lb) > thresh) c++
  }
  return { c, n }
}

let exitCode = 0
let browser
try {
  if (!REUSE) {
    console.log(`→ starting vite dev on :${PORT}…`)
    spawnProc("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], "vite")
    await waitPort(PORT, "vite")
    await sleep(1500) // first compile
  } else {
    console.log(`→ reusing vite at ${BASE}`)
  }

  browser = await webkit.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(`pageerror: ${e}`))
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`) })

  console.log("→ loading road-flicker harness…")
  await page.goto(`${BASE}/qa/road-flicker.html`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpRoad && window.__wpRoad.ready, { timeout: 20000 })
  await page.waitForTimeout(1800) // let the bake + first frames settle

  const R = () => page.evaluate(() => window.__wpRoad.render())

  // ---- helper: run a slow pan at a fixed view, return worst hard-flip ratio in
  //      a crop, while NOTHING in the world is animating fast. ----
  async function probe(setupName, crop, panStep, frames = 8) {
    await page.evaluate((s) => window.__wpRoad[s](), setupName)
    await R()
    await page.waitForTimeout(250)
    const grabs = []
    for (let i = 0; i < frames; i++) {
      await page.evaluate((d) => window.__wpRoad.pan(d), panStep)
      await R()
      await page.waitForTimeout(40)
      grabs.push(await grabCrop(page, ...crop))
    }
    let worst = 0
    let nn = 0
    for (let i = 1; i < grabs.length; i++) {
      const { c, n } = hardFlips(grabs[i - 1], grabs[i])
      // discount the small slice that genuinely moved due to the pan by using a
      // tiny pan; remaining hard flips over a static cobble field == z-fight.
      worst = Math.max(worst, c)
      nn = n
    }
    return { worst, n: nn, ratio: worst / nn }
  }

  // Road crop: lower-centre band where the cobble street recedes at grazing.
  const STREET_CROP = [360, 430, 560, 300] // x,y,w,h
  const PLAZA_CROP = [420, 380, 440, 320]
  const TOPDOWN_CROP = [440, 250, 400, 360]

  console.log("→ probe 1: grazing down a long cobble STREET (slow pan)…")
  const street = await probe("setGrazingStreet", STREET_CROP, 0.0015)
  await page.screenshot({ path: "/tmp/wp-road-street-grazing.png" })

  console.log("→ probe 2: grazing skim across the flagstone PLAZA…")
  const plaza = await probe("setGrazingPlaza", PLAZA_CROP, 0.0015)
  await page.screenshot({ path: "/tmp/wp-road-plaza-grazing.png" })

  console.log("→ probe 3: straight TOP-DOWN (angle-independent z-fight test)…")
  const topdown = await probe("setTopDown", TOPDOWN_CROP, 0.0015)
  await page.screenshot({ path: "/tmp/wp-road-topdown.png" })

  console.log("→ shot: walking view…")
  await page.evaluate(() => window.__wpRoad.setWalk())
  await R()
  await page.waitForTimeout(200)
  await page.screenshot({ path: "/tmp/wp-road-walk.png" })

  const fmt = (r) => `${r.worst}/${r.n} (${(r.ratio * 100).toFixed(4)}%)`
  console.log("\n================ ROAD-FLICKER RESULTS ================")
  console.log(`street grazing  : ${fmt(street)}`)
  console.log(`plaza  grazing  : ${fmt(plaza)}`)
  console.log(`top-down        : ${fmt(topdown)}`)
  console.log("screenshots     : /tmp/wp-road-street-grazing.png, -plaza-grazing.png, -topdown.png, -walk.png")
  console.log("page errors     :", errs.length ? errs.slice(0, 5) : "none")

  // PASS bar: essentially zero hard depth-flips. A static cobble field under a
  // tiny pan should be ~0%. We allow a tiny budget for sub-pixel pan smear.
  const BUDGET = 0.0015 // 0.15%
  const pass =
    street.ratio < BUDGET && plaza.ratio < BUDGET && topdown.ratio < BUDGET && errs.length === 0
  console.log("\n" + (pass ? "PASS: no road z-fight / shimmer flicker" : "FAIL: flicker detected"))
  console.log("======================================================")
  exitCode = pass ? 0 : 1
} catch (e) {
  console.error("ROAD-FLICKER ERROR:", e)
  exitCode = 2
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
