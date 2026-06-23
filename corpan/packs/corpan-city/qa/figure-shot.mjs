/**
 * figure-shot — walk a loop and grab screenshots to eyeball the crowd figures
 * (dissolve / missing-limb check) while we tune their culling. Saves PNGs to
 * /tmp/wp-fig-*.png.
 */
import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5174"
const tag = process.argv[3] ?? "x"
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
await page.screenshot({ path: `/tmp/wp-fig-${tag}-0.png` })
// walk forward to mix with the crowd, then strafe + orbit
const k = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key) }
await k("w", 1200)
await page.screenshot({ path: `/tmp/wp-fig-${tag}-1.png` })
// orbit so figures pass behind + at the lens edge
await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(940, 400, { steps: 8 }); await page.mouse.up()
await page.waitForTimeout(500)
await page.screenshot({ path: `/tmp/wp-fig-${tag}-2.png` })
await k("w", 800)
await page.screenshot({ path: `/tmp/wp-fig-${tag}-3.png` })
const draws = await page.evaluate(() => (window.__wpPhases ? window.__wpPhases() : null))
console.log(`[${tag}] phases:`, JSON.stringify(draws))
await browser.close()
