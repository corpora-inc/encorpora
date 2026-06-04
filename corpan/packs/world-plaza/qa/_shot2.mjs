import { webkit } from "playwright"
const url = process.argv[2]
const out = process.argv[3]
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({
    name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
    avatar: { base: "body-1", layers: [] },
  }))
})
await page.goto(url, { waitUntil: "load" })
await page.waitForSelector("canvas", { timeout: 20000 })
await page.waitForTimeout(3000)
// nudge a few steps to load chunks and settle camera behind player
await page.keyboard.down("s"); await page.waitForTimeout(700); await page.keyboard.up("s")
await page.waitForTimeout(2500)
await page.screenshot({ path: out })
console.log("shot:", out)
await browser.close()
