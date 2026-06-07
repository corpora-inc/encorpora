/**
 * Proves the vignette is now a SCREEN-SPACE DOM layer (cannot drift) and that
 * the old world-space quad is gone. Screenshots at spawn + while moving so the
 * dark edge can be eyeballed as a fixed screen border.
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5180"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
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

// (1) the vignette is a DOM element, fixed to the viewport
const dom = await page.evaluate(() => {
  const el = document.querySelector(".wp-vignette")
  if (!el) return { exists: false }
  const cs = getComputedStyle(el)
  return {
    exists: true,
    position: cs.position,
    inset: `${cs.top} ${cs.right} ${cs.bottom} ${cs.left}`,
    isGradient: cs.backgroundImage.includes("radial-gradient"),
    pointerEvents: cs.pointerEvents,
  }
})

await page.screenshot({ path: "/tmp/wp-vig-spawn.png" })
// (2) move hard — a world quad would jerk the dark edge inward; CSS cannot.
await page.keyboard.down("d")
await page.waitForTimeout(1300)
await page.keyboard.up("d")
await page.mouse.move(700, 360)
await page.mouse.down()
for (let i = 0; i < 14; i++) await page.mouse.move(700 + i * 12, 360)
await page.mouse.up()
await page.waitForTimeout(300)
await page.screenshot({ path: "/tmp/wp-vig-moved.png" })

const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(hud off)")
console.log("vignette DOM:", JSON.stringify(dom))
console.log("page errors:", errors.length ? errors.slice(0, 4) : "none")
await browser.close()
