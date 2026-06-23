/**
 * heading-verify — proves the player figure FACES ITS MOVEMENT DIRECTION instead
 * of moonwalking. The follow camera stays behind the LOOK yaw (which strafing does
 * NOT change), so:
 *   • walk forward (w)  → moving away from camera → we see the BACK.
 *   • strafe right (d)  → moving +screen-right while camera stays put → the figure
 *                          should TURN to face right (right-facing profile), not
 *                          keep showing its back.
 *   • strafe left  (a)  → mirror: left-facing profile.
 * Screenshots mid-motion (heading only applies while speed>0.05) → /tmp/wp-head-*.png
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const shot = (n) => `/tmp/wp-head-${n}.png`

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()) })

await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(1500)

// Skip onboarding into the world (Skip → defaultIdentity).
for (let i = 0; i < 6; i++) {
  const skip = page.locator("text=/^Skip$/i").first()
  if (await skip.count().catch(() => 0)) {
    await skip.click().catch(() => {})
    await page.waitForTimeout(700)
  }
  const begin = page.locator("text=/^(Begin|Enter|Start|Step in)/i").first()
  if (await begin.count().catch(() => 0)) {
    await begin.click().catch(() => {})
    await page.waitForTimeout(700)
  }
}
await page.waitForTimeout(2000)
await page.screenshot({ path: shot("0-world") })

// FORWARD — expect the back of the figure.
await page.keyboard.down("w")
await page.waitForTimeout(900)
await page.screenshot({ path: shot("1-forward") })
await page.keyboard.up("w")
await page.waitForTimeout(600)

// STRAFE RIGHT — expect the figure turned to face screen-right (profile), moving.
await page.keyboard.down("d")
await page.waitForTimeout(700)
await page.screenshot({ path: shot("2-strafe-right") })
await page.waitForTimeout(500)
await page.screenshot({ path: shot("3-strafe-right-b") })
await page.keyboard.up("d")
await page.waitForTimeout(600)

// STRAFE LEFT — mirror.
await page.keyboard.down("a")
await page.waitForTimeout(800)
await page.screenshot({ path: shot("4-strafe-left") })
await page.keyboard.up("a")
await page.waitForTimeout(300)

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors")
await browser.close()
