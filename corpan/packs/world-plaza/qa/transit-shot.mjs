/**
 * transit-shot — fire each transit vignette via the dev hook and screenshot the
 * boarding hall, then drive a destination → challenge → arrival so we can confirm
 * the flow resolves + the city respawns. Saves /tmp/wp-transit-*.png.
 */
import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5174"
const mode = process.argv[3] ?? "bus" // bus|train|flight|taxi
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errs = []
page.on("pageerror", (e) => errs.push(e.message))
page.on("console", (m) => { const t = m.text(); if (/error|fail|throw/i.test(t)) errs.push("CON: " + t.slice(0, 160)) })
await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({ name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } }, avatar: { base: "body-1", layers: [] } }))
})
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2500)
await page.click(".wp-entry-lang", { timeout: 1500 }).catch(() => {})
await page.click(".wp-entry-btn", { timeout: 4000 }).catch(() => {})
await page.waitForFunction(() => typeof window.__wpEnterTransit === "function", { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(800)
// fire the transit vignette
await page.evaluate((m) => window.__wpEnterTransit(m), mode)
await page.waitForTimeout(1500)
await page.screenshot({ path: `/tmp/wp-transit-${mode}-hall.png` })
// pick the first destination
const destBtn = mode === "taxi" ? ".wp-vig-taxi-dest" : ".wp-vig-board-dest"
const clicked = await page.click(destBtn, { timeout: 3000 }).then(() => true).catch(() => false)
await page.waitForTimeout(1200)
await page.screenshot({ path: `/tmp/wp-transit-${mode}-challenge.png` })
console.log(`[${mode}] destClicked=${clicked} errs=${errs.length}`)
if (errs.length) console.log(errs.slice(0, 6).join("\n"))
await browser.close()
