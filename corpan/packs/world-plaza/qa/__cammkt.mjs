import { webkit } from "playwright"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
const vite = spawn("npx", ["vite", "--port", "5214", "--strictPort"], { cwd: process.cwd(), stdio: "ignore" })
process.on("exit", () => { try { vite.kill("SIGKILL") } catch {} })
await sleep(3000)
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 700 } })
const errs = []; page.on("pageerror", e => errs.push(String(e)))
await page.goto("http://localhost:5214/qa/cammarket.html", { waitUntil: "load" })
await page.waitForTimeout(2500)
const analyze = () => page.evaluate(() => {
  const cv = document.getElementById("wp-canvas")
  const oc = document.createElement("canvas"); oc.width = 900; oc.height = 700
  oc.getContext("2d").drawImage(cv, 0, 0)
  const d = oc.getContext("2d").getImageData(0, 0, 900, 700).data
  let red = 0, n = 0
  for (let i = 0; i < d.length; i += 4) { const r=d[i],g=d[i+1],b=d[i+2]; n++; if (r>110 && r>g+50 && r>b+50) red++ }
  return { redPct: +(100*red/n).toFixed(3) }
})
// player faces yaw=0 → camera trails to +z into the stall row at z=9.
for (const [x,z,yaw,label] of [[0,5,0,"cam-into-stallrow"],[0,6,0,"cam-deeper-into-stalls"],[0,7.5,0,"cam-pressed-stalls"]]) {
  await page.evaluate(([x,z,y]) => window.__wpCam.setPlayer(x,z,y), [x,z,yaw])
  await page.waitForTimeout(1000)
  const a = await analyze()
  const camY = await page.evaluate(() => window.__wpCam.camY())
  await page.screenshot({ path: `/tmp/wp-cammkt-${label}.png` })
  console.log(`${label}: player-red=${a.redPct}% camY=${camY.toFixed(2)} ${a.redPct>0.05?"VISIBLE":"HIDDEN!"}`)
}
console.log("errs:", errs.length, errs.slice(0,3))
await browser.close(); process.exit(0)
