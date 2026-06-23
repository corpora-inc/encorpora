/** Screenshot the assembled grand town (map + buildings + dressing + roads). */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
const warns = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") warns.push(`${m.type()}: ${m.text()}`)
})
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
await page.waitForTimeout(3500) // buildings + dressing build
await page.keyboard.press("p") // perf HUD
await page.waitForTimeout(300)
await page.screenshot({ path: "/tmp/wp-grand-1.png" })

// walk down a street + orbit
await page.keyboard.down("w")
await page.waitForTimeout(1600)
await page.keyboard.up("w")
await page.mouse.move(800, 400)
await page.mouse.down()
for (let i = 0; i < 12; i++) await page.mouse.move(800 + i * 10, 400)
await page.mouse.up()
await page.waitForTimeout(400)
await page.screenshot({ path: "/tmp/wp-grand-2.png" })

const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(no hud)")
console.log("PERF:\n" + hud)
console.log("page errors:", errors.length ? errors.slice(0, 5) : "none")
console.log("console warn/err:", warns.length ? warns.slice(0, 5) : "none")
await browser.close()
