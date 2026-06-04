import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5188"
const out = process.argv[3] ?? "/tmp/wp-world-baseline.png"
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
await page.waitForTimeout(3500)
await page.screenshot({ path: out })
console.log("shot:", out)
await browser.close()
