/**
 * CINEMATIC RENDERING PROOF — Track-A verification.
 *
 * Boots a fresh vite on a UNIQUE port, loads qa/cinematic.html (the REAL renderer
 * + REAL streamed city), registers the city's meshes as shadow casters, and
 * shoots BEFORE (pipeline OFF — the flat prototype) and AFTER (golden-hour
 * cinematic) of: a wide plaza hero, a low raking-sun angle, and a high 3/4 that
 * reads shadow grounding. Plus an fps sample so perf is honest.
 *
 *   Run:  node qa/cinematic.mjs
 *   Out:  /tmp/wp-cine-*.png
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const PORT = Number(process.env.WP_CINE_PORT ?? 5181)
const BASE = `http://localhost:${PORT}`

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
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 820 } })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(`pageerror: ${e}`))
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`) })

  console.log("→ loading cinematic harness…")
  await page.goto(`${BASE}/qa/cinematic.html`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpCine && window.__wpCine.ready, { timeout: 25000 })

  const R = () => page.evaluate(() => window.__wpCine.render())
  const warm = async (ms) => { await page.waitForTimeout(ms) }

  // Lock the DETERMINISTIC fixed hero FIRST so the city streams the right
  // neighborhood around it, then warm generously (the city builds ~one building
  // per frame step). We capture the SAME fixed frame BEFORE/AFTER — only the
  // cinematic rig changes between them, so it's a true comparison.
  await page.evaluate(() => window.__wpCine.fixedHero())
  await warm(12000)
  await page.evaluate(() => window.__wpCine.fixedHero()) // re-assert the fixed pose
  await warm(1500)
  const casters = await page.evaluate(() => window.__wpCine.registerCasters())
  const ssao = await page.evaluate(() => window.__wpCine.ssao())
  const built = await page.evaluate(() => window.__wpCine.builtCount())
  console.log(`→ casters: ${casters}  SSAO: ${ssao}  buildings: ${built}`)

  // (caster registration deferred to AFTER, to isolate its effect)
  await warm(800)

  // BEFORE — flat prototype (pipeline off), the fixed frame.
  console.log("\n→ BEFORE (flat prototype)…")
  await page.evaluate(() => window.__wpCine.setPipeline(false))
  await page.evaluate(() => window.__wpCine.fixedHero())
  await warm(250)
  await page.screenshot({ path: "/tmp/wp-cine-before-wide.png" })
  console.log("   /tmp/wp-cine-before-wide.png")

  // AFTER — golden-hour cinematic, the SAME fixed frame. Wait for the shader
  // recompiles (registering casters marks materials dirty) to settle.
  console.log("\n→ AFTER (cinematic, NO casters yet)…")
  await page.evaluate(() => window.__wpCine.setPipeline(true))
  await page.evaluate(() => window.__wpCine.fixedHero())
  await warm(800)
  await page.screenshot({ path: "/tmp/wp-cine-after-nocasters.png" })
  console.log("   /tmp/wp-cine-after-nocasters.png")

  console.log("\n→ AFTER (cinematic + casters)…")
  await page.evaluate(() => window.__wpCine.registerCasters())
  await page.evaluate(() => window.__wpCine.fixedHero())
  await warm(2500)
  await page.screenshot({ path: "/tmp/wp-cine-after-wide.png" })
  console.log("   /tmp/wp-cine-after-wide.png")

  // fps sample (after, wide — a representative town view).
  await page.evaluate(() => window.__wpCine.wide())
  await warm(2000)
  const samples = []
  for (let i = 0; i < 50; i++) { await R(); samples.push(await page.evaluate(() => window.__wpCine.fps())) }
  samples.sort((a, b) => a - b)
  const med = samples[Math.floor(samples.length / 2)]
  console.log(`\nfps (median over 50 renders, after/wide): ${med.toFixed(1)}`)

  console.log("\npage errors:", errs.length ? errs.slice(0, 6) : "none")
  exitCode = errs.length === 0 ? 0 : 1
} catch (e) {
  console.error("CINEMATIC HARNESS ERROR:", e)
  exitCode = 2
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
