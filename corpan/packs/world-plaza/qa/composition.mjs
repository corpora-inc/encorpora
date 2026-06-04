/**
 * COMPOSITION / SPACING PROOF — Agent-B verification for World Plaza's relaxed,
 * zoned town layout.
 *
 * Two layers:
 *   1. A PURE planner audit (no browser): re-derive the composition plan and
 *      assert the SPACING DISCIPLINE — no two props closer than a global floor,
 *      no prop inside a collision blocker, every zone present, density falls off
 *      toward the edges. Fast, deterministic, the real correctness gate.
 *   2. A WebKit render pass (Playwright): boot a fresh vite on a unique port,
 *      load qa/composition.html (the REAL world look over the enlarged map), and
 *      screenshot the zoned town — whole-map top-down, town-core top-down, a long
 *      avenue sightline, an over-the-shoulder plaza — plus an fps sample. Saves
 *      /tmp/wp-comp-*.png and tears vite down promptly.
 *
 *   Run:  node qa/composition.mjs
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { readFileSync } from "node:fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const PORT = Number(process.env.WP_COMP_PORT ?? 5192)
const BASE = `http://localhost:${PORT}`

/* ----------------------------------------------------------- planner audit */
// Re-implement the bits of composition.ts needed to AUDIT its output without a
// TS toolchain in this .mjs: we instead import the plan THROUGH the browser
// mount (window.__wpComp.plan gives zones + counts). For the spacing/overlap
// audit we read the raw placements via a tiny page hook. To keep this file
// self-contained we compute overlaps in-page where the plan lives.

const topology = JSON.parse(
  readFileSync(resolve(packDir, "content/topologies/plaza-grand.json"), "utf8"),
)

/* ----------------------------------------------------------- vite plumbing */

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
  console.log(`→ starting vite dev on :${PORT}…`)
  spawnProc("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], "vite")
  await waitPort(PORT, "vite")
  await sleep(1500)

  browser = await webkit.launch()
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(`pageerror: ${e}`))
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`) })

  console.log("→ loading composition harness…")
  await page.goto(`${BASE}/qa/composition.html`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpComp && window.__wpComp.ready, { timeout: 25000 })
  await page.waitForTimeout(2000) // bake + settle

  const plan = await page.evaluate(() => window.__wpComp.plan)
  console.log("\n================ COMPOSITION PLAN ================")
  console.log("bounds:", JSON.stringify(topology.bounds))
  const area = (topology.bounds.maxX - topology.bounds.minX) * (topology.bounds.maxZ - topology.bounds.minZ)
  console.log(`area: ${area} u²  (vs old 80×80=6400 → ${(area / 6400).toFixed(1)}× )`)
  console.log("zones:", JSON.stringify(plan.zones))
  console.log("counts:", JSON.stringify(plan.counts))
  console.log("total props:", plan.total)

  /* ---- PLANNER AUDIT (recompute placements in-page for overlap/gap test) ---- */
  const audit = await page.evaluate(async () => {
    const mod = await import("/src/world/composition.ts")
    const topo = (await import("/content/topologies/plaza-grand.json")).default
    const caps = {
      trees: 120, palms: 12, lamps: 90, planters: 36, marketProps: 48,
      signposts: 28, carts: 2, stalls: 6, benches: 14, troughs: 2,
    }
    const r = mod.composeDressing(topo, { seed: 1770, caps })
    const ps = r.placements
    // 1) no prop inside a blocker (pad 0).
    const blockers = topo.blockers
    let inBlocker = 0
    for (const p of ps) {
      for (const b of blockers) {
        if (Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.z - b.z) <= b.d / 2) { inBlocker++; break }
      }
    }
    // 2) global min-gap: nearest-neighbour distance over ALL props.
    let minGap = Infinity
    let collisions = 0
    const GAP = 1.0
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[i].x - ps[j].x
        const dz = ps[i].z - ps[j].z
        const d = Math.hypot(dx, dz)
        if (d < minGap) minGap = d
        if (d < GAP) collisions++
      }
    }
    // 3) density falloff: prop density in the inner half vs outer half.
    const bs = topo.bounds
    const cx = (bs.minX + bs.maxX) / 2, cz = (bs.minZ + bs.maxZ) / 2
    const maxR = Math.hypot(bs.maxX - cx, bs.maxZ - cz)
    let inner = 0, outer = 0
    for (const p of ps) {
      const rr = Math.hypot(p.x - cx, p.z - cz)
      if (rr < maxR * 0.5) inner++; else outer++
    }
    // areas of inner disc vs outer annulus (within the square ~ use disc approx)
    const innerArea = Math.PI * (maxR * 0.5) ** 2
    const outerArea = Math.PI * maxR ** 2 - innerArea
    return {
      count: ps.length, inBlocker, minGap, collisions,
      innerDensity: inner / innerArea, outerDensity: outer / outerArea,
      bySpecies: r.counts, zones: r.zones,
    }
  })

  console.log("\n================ SPACING AUDIT ================")
  console.log(`props placed       : ${audit.count}`)
  console.log(`inside a blocker   : ${audit.inBlocker}  (must be 0)`)
  console.log(`global min gap     : ${audit.minGap.toFixed(3)} u  (must be ≥ 1.0)`)
  console.log(`pairs closer than 1u: ${audit.collisions}  (must be 0)`)
  console.log(`inner density      : ${(audit.innerDensity * 1000).toFixed(2)} /1000u²`)
  console.log(`outer density      : ${(audit.outerDensity * 1000).toFixed(2)} /1000u²  (must be < inner → falloff)`)
  console.log(`zones present      : plaza=${!!audit.zones.plaza} market=${!!audit.zones.market} garden=${!!audit.zones.garden} avenues=${audit.zones.avenues}`)

  /* ------------------------------ screenshots ------------------------------ */
  const R = () => page.evaluate(() => window.__wpComp.render())
  const shot = async (setup, file) => {
    await page.evaluate((s) => window.__wpComp[s](), setup)
    await R()
    await page.waitForTimeout(350)
    await R()
    await page.screenshot({ path: file })
    console.log(`   shot ${file}`)
  }
  console.log("\n→ screenshots…")
  await shot("topDown", "/tmp/wp-comp-topdown.png")
  await shot("topDownTight", "/tmp/wp-comp-topdown-core.png")
  await shot("avenue", "/tmp/wp-comp-avenue.png")
  await shot("plaza", "/tmp/wp-comp-plaza.png")

  // fps sample over a short window in the avenue view (worst-ish: most props in frame).
  await page.evaluate(() => window.__wpComp.avenue())
  for (let i = 0; i < 30; i++) { await R() }
  const fpsSamples = []
  for (let i = 0; i < 40; i++) {
    await R()
    fpsSamples.push(await page.evaluate(() => window.__wpComp.fps()))
  }
  fpsSamples.sort((a, b) => a - b)
  const medFps = fpsSamples[Math.floor(fpsSamples.length / 2)]
  console.log(`\nfps (median over 40 renders, avenue view): ${medFps.toFixed(1)}`)

  console.log("\npage errors:", errs.length ? errs.slice(0, 5) : "none")

  const pass =
    audit.inBlocker === 0 &&
    audit.collisions === 0 &&
    audit.minGap >= 1.0 - 1e-6 &&
    audit.outerDensity < audit.innerDensity &&
    !!audit.zones.plaza && !!audit.zones.market && !!audit.zones.garden && audit.zones.avenues > 0 &&
    medFps >= 58 &&
    errs.length === 0
  console.log("\n" + (pass ? "PASS: relaxed, zoned, well-spaced town" : "FAIL: see audit above"))
  exitCode = pass ? 0 : 1
} catch (e) {
  console.error("COMPOSITION ERROR:", e)
  exitCode = 2
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
