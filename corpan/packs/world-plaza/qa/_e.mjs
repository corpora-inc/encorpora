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
// noatmo to isolate the skyline from the sky dome
await page.goto(`${BASE}/qa/edge.html?noatmo=1`, { waitUntil: "load" })
await page.waitForTimeout(5000)
const info = await page.evaluate(() => {
  const scene = window.__wpScene
  const sl = scene.meshes.filter(m=>m.name.includes("wp-skyline"))
  return sl.map(m=>({name:m.name, enabled:m.isEnabled(), vis:m.visibility, infD:m.infiniteDistance, rg:m.renderingGroupId, verts:m.getTotalVertices(), matAlpha: m.material&&m.material.alpha, hasOpac: !!(m.material&&m.material.opacityTexture)}))
})
console.log("SKYLINE", JSON.stringify(info,null,1))
const w = await page.evaluate(() => window.__wpEdge.water())
await page.evaluate((w) => window.__wpEdge.setView(-Math.PI/2, 1.4, 30, 0, w.farPromZ), w)
await page.waitForTimeout(1000)
await page.screenshot({ path: "/tmp/wp-sky-noatmo.png" })
await browser.close()
process.exit(0)
