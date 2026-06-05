import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
const vite = spawn("npx", ["vite", "--port", "5215", "--strictPort"], { cwd: process.cwd(), stdio: "ignore" })
process.on("exit", () => { try { vite.kill("SIGKILL") } catch {} })
await sleep(3000)
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
const errs = []; page.on("pageerror", e => errs.push(String(e)))
// reuse the cammarket harness but the test: a STALL row in the camera trail at low
// height — drive the player so the camera (trailing +z) lands among the stalls,
// and read whether the camera ends INSIDE any occluder AABB.
await page.addInitScript(() => { window.__LOWCAM = true })
await page.goto("http://localhost:5215/qa/cammarket.html", { waitUntil: "load" })
await page.waitForTimeout(2500)
// expose an inside-occluder probe from the page
const probe = () => page.evaluate(() => {
  const scene = window.__wpCam._scene || null
  return window.__wpCam.insideOccluder ? window.__wpCam.insideOccluder() : "no-probe"
})
for (const [x,z] of [[0,2],[0,4],[0,6]]) {
  await page.evaluate(([x,z]) => window.__wpCam.setPlayer(x,z,0), [x,z])
  await page.waitForTimeout(1000)
  console.log(`player z=${z}: ${JSON.stringify(await probe())}`)
}
console.log("errs:", errs.length)
await browser.close(); process.exit(0)
