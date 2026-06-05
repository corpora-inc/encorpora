import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
const PORT = 5198, BASE = `http://localhost:${PORT}`
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: process.cwd(), stdio: "inherit" })
process.on("exit", () => { try { vite.kill("SIGTERM") } catch {} })
await sleep(2800)
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on("pageerror", (e) => console.log("ERR", String(e)))
await page.goto(`${BASE}/qa/edge.html`, { waitUntil: "load" })
await page.waitForTimeout(5000)
const w = await page.evaluate(() => window.__wpEdge.water())
// camera AT the near quay (z just below waterZ), low + looking ACROSS the river
// toward +Z (the far bank + skyline). alpha=PI/2 puts cam at -Z of target looking +Z.
await page.evaluate((w) => {
  // target out on the far side so the cam sits at the near quay looking across
  window.__wpEdge.setView(Math.PI/2, 1.5, 60, 0, w.farPromZ+20)
}, w)
await page.waitForTimeout(1200)
await page.screenshot({ path: "/tmp/wp-sky-across.png" })
// also a wider, slightly elevated framing of the whole far side
await page.evaluate((w) => window.__wpEdge.setView(Math.PI/2, 1.3, 90, 0, w.farPromZ+40), w)
await page.waitForTimeout(1000)
await page.screenshot({ path: "/tmp/wp-sky-wide.png" })
console.log("done", JSON.stringify(w))
await browser.close()
process.exit(0)
