/**
 * Verifies proximity NPC engagement: walk toward an NPC, expect the floating
 * prompt + Talk button to appear, then engage and expect a greeting toast.
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(1500)

// strafe toward the tailor NPC (world -x)
await page.keyboard.down("d")
await page.waitForTimeout(2200)
await page.keyboard.up("d")
await page.waitForTimeout(300)

const promptVisible = await page.$eval(".wp-prompt", (el) => el.style.display !== "none").catch(() => false)
const btnVisible = await page.$eval(".wp-interact", (el) => el.style.display !== "none").catch(() => false)
await page.screenshot({ path: "/tmp/wp-focus.png" })

// engage via the Talk button if present, else key
if (btnVisible) await page.click(".wp-interact").catch(() => {})
else await page.keyboard.press("e")
await page.waitForTimeout(400)
const toast = await page.$eval(".wp-toast", (el) => el.textContent).catch(() => "(none)")
await page.screenshot({ path: "/tmp/wp-greet.png" })

console.log("prompt visible:", promptVisible)
console.log("Talk button visible:", btnVisible)
console.log("toast text:", toast)
console.log("errors:", errors.length ? errors : "none")
await browser.close()
