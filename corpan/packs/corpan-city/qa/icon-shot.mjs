/**
 * STORE-ICON CAPTURE — renders the REAL Corpan City hero frame (cinematic
 * engine + streamed city + dressed hero paper-person) at 512×512 and saves
 * three candidate framings as OPAQUE PNGs.
 *
 *   Run:  node qa/icon-shot.mjs
 *   Out:  /tmp/wp-icon-{hero,alt,plaza}.png   (512×512, no alpha)
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")

const PORT = Number(process.env.WP_ICON_PORT ?? 5188)
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
  // 512×512 square viewport → frame composed for the square icon directly.
  const page = await (await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(`pageerror: ${e}`))
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`) })

  console.log("→ loading icon harness…")
  await page.goto(`${BASE}/qa/icon.html`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpIcon && window.__wpIcon.ready, { timeout: 25000 })

  const warm = (ms) => page.waitForTimeout(ms)
  const shoot = async (which, file) => {
    await page.evaluate((w) => window.__wpIcon[w](), which)
    await warm(11000) // let the city stream in around the framed point
    await page.evaluate((w) => window.__wpIcon[w](), which) // re-assert pose after streaming
    await warm(1200)
    await page.evaluate(() => window.__wpIcon.registerCasters())
    await warm(1500) // shadow shaders recompile
    await page.evaluate(() => window.__wpIcon.render())
    await warm(300)
    const built = await page.evaluate(() => window.__wpIcon.builtCount())
    // omitBackground:false → opaque (no alpha). PNG.
    await page.screenshot({ path: file, omitBackground: false })
    console.log(`   ${file}  (buildings streamed: ${built})`)
  }

  console.log("\n→ HERO framing…")
  await shoot("hero", "/tmp/wp-icon-hero.png")
  console.log("→ ALT framing…")
  await shoot("heroAlt", "/tmp/wp-icon-alt.png")
  console.log("→ PLAZA framing…")
  await shoot("heroPlaza", "/tmp/wp-icon-plaza.png")

  console.log("\npage errors:", errs.length ? errs.slice(0, 8) : "none")
  exitCode = errs.length === 0 ? 0 : 1
} catch (e) {
  console.error("ICON HARNESS ERROR:", e)
  exitCode = 2
} finally {
  if (browser) await browser.close()
  cleanup()
}
process.exit(exitCode)
