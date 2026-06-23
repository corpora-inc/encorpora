/**
 * ROOF UNDER-EAVE CHECK — verifies the double-sided gable fix. Boots the buildings
 * harness and parks the orbit camera BELOW the roofline looking UP (beta > 90°) at
 * the eaves + gable end, where a single-sided prism was see-through. Self-contained.
 */
import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = 5198
const portOpen = (p) => new Promise((r) => { const s = net.connect(p, "127.0.0.1"); s.once("connect", () => { s.destroy(); r(true) }); s.once("error", () => r(false)) })
const vite = spawn("npm", ["run", "dev", "--", "--port", String(PORT), "--strictPort"], { cwd: packDir, stdio: "pipe", detached: true })
vite.stdout.on("data", (d) => process.stdout.write(`[vite] ${d}`))
try {
  for (let i = 0; i < 60 && !(await portOpen(PORT)); i++) await sleep(250)
  const browser = await webkit.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/qa/buildings.html`, { waitUntil: "load" })
  await page.waitForFunction(() => !!window.__wpBuildings, { timeout: 8000 })
  await page.waitForTimeout(1400)
  const D2R = Math.PI / 180
  // beta > 90° → camera dips below the roofline and looks UP at the underside.
  const shots = [
    { name: "under-eave", alpha: -70 * D2R, beta: 104 * D2R, radius: 9, ty: 2.4 },
    { name: "gable-end", alpha: 8 * D2R, beta: 99 * D2R, radius: 10, ty: 2.6 },
  ]
  for (const s of shots) {
    await page.evaluate(([a, b, r, ty]) => window.__wpBuildings.setAngle(a, b, r, ty), [s.alpha, s.beta, s.radius, s.ty])
    await page.waitForTimeout(300)
    await page.screenshot({ path: `/tmp/wp-roof-${s.name}.png` })
  }
  console.log("roof shots: /tmp/wp-roof-under-eave.png, /tmp/wp-roof-gable-end.png")
  console.log("pageerrors:", errors.length ? errors.slice(0, 5) : "none")
  await browser.close()
} finally {
  try { process.kill(-vite.pid) } catch {}
}
