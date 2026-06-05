/**
 * charcloseup driver — snaps the character row from a TRUE front shot, a 3/4,
 * a grazing low angle, and the back, plus a tight single-character face shot to
 * hunt the seam. Characters face +Z, so FRONT = camera alpha ≈ +PI/2.
 * Screenshots → /tmp/wp-char-*.png
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5182"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 820 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()) })

await page.goto(`${base}/qa/charcloseup.html`, { waitUntil: "load" })
await page.waitForFunction(() => window.__charCam?.ready, { timeout: 10000 })
await page.waitForTimeout(1200)

const cam = (a, b, r, ty = 1.2, tx = 0) =>
  page.evaluate(([a, b, r, ty, tx]) => window.__charCam.set(a, b, r, ty, tx), [a, b, r, ty, tx])

const PI = Math.PI
const FRONT = PI / 2 // characters face +Z

// 1. TRUE FRONT, whole row (faces straight on — the seam test)
await cam(FRONT, PI / 2.3, 7, 1.2)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-1-front-row.png" })

// 2. tight FRONT face shot on the player (index 0 → x = -3.8) — seam/face hunt
await cam(FRONT, PI / 2.15, 2.0, 1.92, -3.8)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-2-face-closeup.png" })

// 3. 3/4 view of the row
await cam(FRONT - 0.7, PI / 2.4, 7.5, 1.2)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-3-threequarter.png" })

// 4. GRAZING low angle (where a flat billboard collapses)
await cam(FRONT - 0.3, PI / 1.92, 8, 0.9)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-4-grazing.png" })

// 5. BACK of the row (head/hair/back seam)
await cam(-PI / 2, PI / 2.3, 7, 1.2)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-5-back.png" })

// 6. tight 3/4 single-char face from slightly above (collar/neck read)
await cam(FRONT - 0.55, PI / 2.6, 2.2, 1.86, -3.8)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-6-face-3q.png" })

// 7. the talking NPC (index 2 → x = 0) tight front, mouth should be open
await cam(FRONT, PI / 2.15, 2.0, 1.92, 0)
await page.waitForTimeout(500)
await page.screenshot({ path: "/tmp/wp-char-7-talk.png" })

console.log("errors:", errors.length ? errors.slice(0, 6) : "none")
await browser.close()
console.log("done — /tmp/wp-char-*.png")
