import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5188"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
page.on("pageerror", (e) => errs.push(String(e)))
await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({
    name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
    avatar: { base: "body-1", layers: [] },
  }))
})
await page.goto(url, { waitUntil: "load" })
await page.waitForSelector("canvas", { timeout: 20000 })
await page.waitForTimeout(3000)
// spawn at (0,12), fountain at (0,0): walk forward (toward -Z) to approach it.
await page.keyboard.down("w"); await page.waitForTimeout(2600); await page.keyboard.up("w")
await page.waitForTimeout(2500)
await page.screenshot({ path: "/tmp/wp-world-fountain.png" })
console.log("errs:", errs.length, errs.slice(0,3))
await browser.close()
