import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5188"
const out = process.argv[3] ?? "/tmp/wp-world-population.png"
const browser = await webkit.launch({ args:["--force-device-scale-factor=1"] })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })
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
await page.waitForTimeout(3500)
// wander a bit so strollers are mid-amble around the player
await page.keyboard.down("d"); await page.waitForTimeout(1400); await page.keyboard.up("d")
await page.waitForTimeout(1800)
await page.screenshot({ path: out })
console.log("errs:", errs.length, errs.slice(0,3), "->", out)
await browser.close()
