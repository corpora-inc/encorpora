/** Look-foundation QA: walk to a street, orbit to oblique angles, prove no flicker. */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
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
await page.waitForTimeout(200)

const shot = (n) => page.screenshot({ path: `/tmp/wp-look-${n}.png` })

// 1) walk forward down a street toward the buildings
await page.keyboard.down("w")
await page.waitForTimeout(2600)
await page.keyboard.up("w")
await page.waitForTimeout(300)
await shot("street")

// 2) orbit camera to an oblique low angle (the angle that used to flicker)
await page.mouse.move(640, 400)
await page.mouse.down()
for (let i = 0; i < 30; i++) await page.mouse.move(640 - i * 12, 400 + i * 2)
await page.mouse.up()
await page.waitForTimeout(300)
await shot("oblique-a")

// 3) capture two consecutive frames at the SAME oblique angle to prove stability
await page.waitForTimeout(120)
await shot("oblique-a2")

// 4) keep walking down the cobble street
await page.keyboard.down("w")
await page.waitForTimeout(1800)
await page.keyboard.up("w")
await page.waitForTimeout(300)
await shot("walk")

// 5) orbit the other way for a roof-down view
await page.mouse.move(640, 400)
await page.mouse.down()
for (let i = 0; i < 30; i++) await page.mouse.move(640 + i * 12, 400 - i * 1)
await page.mouse.up()
await page.waitForTimeout(300)
await shot("roofs")

const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(no hud)")
console.log("PERF:\n" + hud)
console.log("page errors:", errors.length ? errors.slice(0, 5) : "none")
await browser.close()
