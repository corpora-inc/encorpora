import { webkit } from "playwright"

const URL = "http://localhost:5731/econ-harness.html"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 430, height: 740 } })
const errors = []
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text())
})
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto(URL, { waitUntil: "networkidle" })
// reward reveal auto-shows on boot
await page.waitForSelector(".wp-reward--in", { timeout: 5000 })
await page.waitForTimeout(900) // let the staggered chips settle
await page.screenshot({ path: "/tmp/wp-econ-reward.png" })
console.log("[shot] reward reveal → /tmp/wp-econ-reward.png")

// market floor: ticker
await page.evaluate(() => window.__wpEcon.openMarket("ticker"))
await page.waitForSelector(".wp-econ--in", { timeout: 5000 })
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-econ-ticker.png" })
console.log("[shot] market ticker → /tmp/wp-econ-ticker.png")

// exchange tab
await page.evaluate(() => {
  document.querySelectorAll(".wp-econ-tab")[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
})
await page.waitForTimeout(400)
await page.screenshot({ path: "/tmp/wp-econ-exchange.png" })
console.log("[shot] exchange → /tmp/wp-econ-exchange.png")

// market (goods) tab
await page.evaluate(() => {
  document.querySelectorAll(".wp-econ-tab")[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }))
})
await page.waitForTimeout(400)
await page.screenshot({ path: "/tmp/wp-econ-market.png" })
console.log("[shot] market goods → /tmp/wp-econ-market.png")

if (errors.length) {
  console.error("[shot] CONSOLE ERRORS:\n" + errors.join("\n"))
}
await browser.close()
console.log(errors.length ? "DONE-WITH-ERRORS" : "DONE-CLEAN")
