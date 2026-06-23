/**
 * Interactive WebKit smoke test (seed of QA workstream #21). Loads the
 * standalone pack, drives movement + look, reads the perf HUD's FPS, and
 * surfaces any console errors. WebKit ≈ the macOS WKWebView the app ships in.
 *
 * Usage: node qa/smoke.mjs [url]
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const shot = (n) => `/tmp/wp-${n}.png`

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })

const errors = []
const logs = []
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`))
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2000)
await page.screenshot({ path: shot("idle") })

// show perf HUD
await page.keyboard.press("p")
await page.waitForTimeout(400)

// walk forward a beat
await page.keyboard.down("w")
await page.waitForTimeout(1400)
await page.keyboard.up("w")

// look: drag on the right half
await page.mouse.move(740, 380)
await page.mouse.down()
for (let i = 0; i < 10; i++) await page.mouse.move(740 + i * 9, 380)
await page.mouse.up()
await page.waitForTimeout(400)
await page.screenshot({ path: shot("moved") })

const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(no hud)")

console.log("PERF HUD:\n" + hud)
console.log("CONSOLE ERRORS:", errors.length ? errors : "none")
const warnish = logs.filter((l) => l.startsWith("error") || l.startsWith("warning"))
console.log("CONSOLE error/warn lines:", warnish.length ? warnish : "none")

await browser.close()
