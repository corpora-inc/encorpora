#!/usr/bin/env node
/**
 * topo-flicker.mjs — the ROAD-FLICKER z-fight proof run against a GENERATED
 * topology (Slice 4c). Identical measurement to qa/road-flicker.mjs (grazing
 * street + grazing plaza + top-down slow-pan, counting hard depth-flip pixels on
 * the baked ground), but it loads qa/topo-render.html?archetype=… so we prove a
 * machine-generated map bakes with the SAME zero z-fight as the authored one.
 *
 * Generated topologies share the EXACT street recipe the bake derives from
 * bounds, so this should read ~0.0000% — the proof that "archetype variety" never
 * costs the z-fight-free invariant.
 *
 *   Run:  node qa/topo-flicker.mjs            # archetype=harbor seed=1770
 *         WP_TOPO_ARCH=walled-town node qa/topo-flicker.mjs
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_TOPO_PORT ?? 5186)
const BASE = process.env.WP_TOPO_BASE ?? `http://localhost:${PORT}`
const REUSE = process.env.WP_TOPO_REUSE === "1"
const ARCH = process.env.WP_TOPO_ARCH ?? "harbor"
const SEED = process.env.WP_TOPO_SEED ?? "1770"

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
      s.once("connect", () => {
        s.destroy()
        done(true)
      })
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
    try {
      process.kill(-p.pid, "SIGKILL")
    } catch {}
    try {
      p.kill("SIGKILL")
    } catch {}
  }
}
process.on("exit", cleanup)
process.on("SIGINT", () => {
  cleanup()
  process.exit(1)
})

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
    await sleep(1500)
  }
  browser = await webkit.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(`pageerror: ${e}`))
  page.on("console", (m) => {
    if (m.type() === "error") errs.push(`console: ${m.text()}`)
  })

  console.log(`→ loading topo-render harness (archetype=${ARCH} seed=${SEED})…`)
  await page.goto(`${BASE}/qa/topo-render.html?archetype=${ARCH}&seed=${SEED}`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpRoad && window.__wpRoad.ready, { timeout: 25000 })
  await page.waitForTimeout(1800)

  const R = () => page.evaluate(() => window.__wpRoad.render())
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
      worst = Math.max(worst, c)
      nn = n
    }
    return { worst, n: nn, ratio: worst / nn }
  }

  const STREET_CROP = [360, 430, 560, 300]
  const PLAZA_CROP = [420, 380, 440, 320]
  const TOPDOWN_CROP = [440, 250, 400, 360]

  console.log("→ probe 1: grazing down a long cobble STREET…")
  const street = await probe("setGrazingStreet", STREET_CROP, 0.0015)
  await page.screenshot({ path: `/tmp/wp-topo-flicker-${ARCH}-street.png` })
  console.log("→ probe 2: grazing skim across the PLAZA…")
  const plaza = await probe("setGrazingPlaza", PLAZA_CROP, 0.0015)
  await page.screenshot({ path: `/tmp/wp-topo-flicker-${ARCH}-plaza.png` })
  console.log("→ probe 3: straight TOP-DOWN…")
  const topdown = await probe("setTopDown", TOPDOWN_CROP, 0.0015)
  await page.screenshot({ path: `/tmp/wp-topo-flicker-${ARCH}-topdown.png` })

  const fmt = (r) => `${r.worst}/${r.n} (${(r.ratio * 100).toFixed(4)}%)`
  console.log(`\n========= TOPO-FLICKER RESULTS (${ARCH}) =========`)
  console.log(`street grazing  : ${fmt(street)}`)
  console.log(`plaza  grazing  : ${fmt(plaza)}`)
  console.log(`top-down        : ${fmt(topdown)}`)
  console.log("page errors     :", errs.length ? errs.slice(0, 5) : "none")

  const BUDGET = 0.0015
  const pass =
    street.ratio < BUDGET && plaza.ratio < BUDGET && topdown.ratio < BUDGET && errs.length === 0
  console.log("\n" + (pass ? "PASS: generated topology bakes with NO road z-fight" : "FAIL: flicker"))
  console.log("==================================================")
  exitCode = pass ? 0 : 1
} catch (e) {
  console.error("TOPO-FLICKER ERROR:", e)
  exitCode = 2
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
