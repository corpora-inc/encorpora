/** Sustained FPS sample on the grand town while walking + orbiting. */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
})
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(3500)
await page.keyboard.press("p")

// Walk + orbit while sampling fps every 250ms for ~5s.
const samples = []
await page.keyboard.down("w")
for (let i = 0; i < 20; i++) {
  await page.mouse.move(640, 400)
  await page.mouse.down()
  await page.mouse.move(640 + 40, 400)
  await page.mouse.up()
  await page.waitForTimeout(250)
  const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "")
  const m = /fps (\d+)/.exec(hud)
  if (m) samples.push(Number(m[1]))
}
await page.keyboard.up("w")

samples.sort((a, b) => a - b)
const avg = samples.reduce((s, x) => s + x, 0) / samples.length
const p5 = samples[Math.floor(samples.length * 0.1)]
console.log("fps samples:", samples.join(" "))
console.log(`avg ${avg.toFixed(1)}  min ${samples[0]}  p10 ${p5}`)
console.log(p5 >= 58 ? "PASS: >=58fps sustained" : "WARN: dips below 58")
await browser.close()
