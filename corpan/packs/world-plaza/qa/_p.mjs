import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
const PORT = 5195, BASE = `http://localhost:${PORT}`
const vite = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], { cwd: process.cwd(), stdio: "inherit" })
process.on("exit", () => { try { vite.kill("SIGTERM") } catch {} })
await sleep(2800)
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on("pageerror", (e) => console.log("ERR", String(e)))
await page.goto(`${BASE}/qa/edge.html?city=1`, { waitUntil: "load" })
await page.waitForTimeout(6000)
// move the streaming origin to the market + frame it. market anchor ~ (46,-68)
// use the edge harness setView; camPos follows target.
await page.evaluate(() => window.__wpEdge.setView(Math.PI*0.62, 1.15, 34, 46, -60))
await page.waitForTimeout(2500) // let market chunks stream in
await page.evaluate(() => window.__wpEdge.setView(Math.PI*0.62, 1.15, 34, 46, -60))
await page.waitForTimeout(1500)
await page.screenshot({ path: "/tmp/wp-market-now.png" })
// plaza/spawn
await page.evaluate(() => window.__wpEdge.setView(Math.PI*0.6, 1.18, 30, 0, 8))
await page.waitForTimeout(2500)
await page.evaluate(() => window.__wpEdge.setView(Math.PI*0.6, 1.18, 30, 0, 8))
await page.waitForTimeout(1500)
await page.screenshot({ path: "/tmp/wp-plaza-now.png" })
console.log("done")
await browser.close()
process.exit(0)
