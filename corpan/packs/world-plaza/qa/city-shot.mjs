import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5174"
const tag = process.argv[3] ?? "city"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({ name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } }, avatar: { base: "body-1", layers: [] } }))
})
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2500)
await page.click(".wp-entry-lang", { timeout: 1500 }).catch(() => {})
await page.click(".wp-entry-btn", { timeout: 4000 }).catch(() => {})
await page.waitForFunction(() => typeof window.__wpScene === "function", { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1500)
const k = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key) }
// walk out of the plaza into a building district
await k("w", 2600)
await page.waitForTimeout(1500)
await page.screenshot({ path: `/tmp/wp-${tag}-a.png` })
await k("d", 1500)
await page.waitForTimeout(1200)
await page.screenshot({ path: `/tmp/wp-${tag}-b.png` })
// orbit up a touch to see rooftops (mouse drag up)
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(640, 250, { steps: 8 }); await page.mouse.up()
await page.waitForTimeout(500)
await page.screenshot({ path: `/tmp/wp-${tag}-c.png` })
const ph = await page.evaluate(() => (window.__wpPhases ? window.__wpPhases() : null))
const ac = await page.evaluate(() => (window.__wpActive ? window.__wpActive() : null))
console.log(`[${tag}]`, JSON.stringify(ph), "\n", JSON.stringify(ac?.top?.slice(0, 8)))
await browser.close()
