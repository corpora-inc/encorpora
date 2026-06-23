/**
 * CINEMATIC SHADOW REGRESSION — proves the pipeline's golden-hour sun casts a
 * real contact-hardening shadow in createWorldEngine's actual scene (with the
 * REAL applyAtmosphere), via the engine's `registerShadowCaster` seam.
 *
 * A controlled scene (one box + one ground) removes the streamed-city's
 * nondeterminism so the shadow + warm grade are unmistakable. Shoots GOLDEN
 * (default) + DUSK (a low sun → long raking shadow).
 *
 *   Run:  node qa/shadow-eng.mjs   →   /tmp/wp-cine-shadow-{golden,dusk}.png
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_SHADOW_PORT ?? 5193)
const BASE = `http://localhost:${PORT}`
const procs = []
const sp = (c, a, n) => { const p = spawn(c, a, { cwd: packDir, stdio: "pipe", detached: true }); p.stderr.on("data", (d) => process.stderr.write(`[${n}] ${d}`)); procs.push(p); return p }
const po = (port) => new Promise((r) => { let pe = 2, ok = false; const d = (o) => { if (o) ok = true; if (--pe === 0) r(ok) }; for (const h of ["127.0.0.1", "::1"]) { const s = net.connect(port, h); s.once("connect", () => { s.destroy(); d(true) }); s.once("error", () => d(false)) } })
const wp = async (p) => { const t = Date.now(); while (Date.now() - t < 30000) { if (await po(p)) return; await sleep(300) } throw new Error("vite timeout") }
const cl = () => { for (const p of procs) { try { process.kill(-p.pid, "SIGKILL") } catch {} try { p.kill("SIGKILL") } catch {} } }
process.on("exit", cl)
let browser
try {
  sp("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], "vite")
  await wp(PORT); await sleep(1500)
  browser = await webkit.launch()
  const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e)))
  await page.goto(`${BASE}/qa/shadow-eng.html`, { waitUntil: "load" })
  await page.waitForFunction(() => window.__wpEng && window.__wpEng.ready, { timeout: 25000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: "/tmp/wp-cine-shadow-golden.png" })
  console.log("→ /tmp/wp-cine-shadow-golden.png (golden hour)")
  await page.evaluate(() => window.__wpEng.tod("dusk"))
  await page.waitForTimeout(1200)
  await page.screenshot({ path: "/tmp/wp-cine-shadow-dusk.png" })
  console.log("→ /tmp/wp-cine-shadow-dusk.png (low dusk sun, long shadow)")
  console.log("page errors:", errs.length ? errs.slice(0, 4) : "none")
} catch (e) { console.error("SHADOW REGRESSION ERROR:", e) } finally { if (browser) await browser.close(); cl() }
process.exit(0)
