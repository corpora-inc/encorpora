/**
 * CITY CAST-SHADOWS verification (this track). Boots the REAL game, lets chunks
 * stream in, reads the live shadow-caster count (proves the bounded player-local
 * set), and shoots the plaza from several angles + near a building so we can read
 * whether the streamed BUILDINGS now throw the sun's directional shadows onto the
 * ground. Also walks to prove streaming still works, and shoots a `?noshadows`
 * A/B so the difference is unmistakable.
 *
 *   Run: node qa/city-shadows.mjs http://localhost:5184
 *   →   /tmp/wp-cityshadow-{boot,bldgL,bldgR,walkfar,noshadows}.png
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5184"
const browser = await webkit.launch()

async function boot(page, { noShadows } = {}) {
  await page.addInitScript((ns) => {
    localStorage.setItem(
      "wp:identity:v1",
      JSON.stringify({
        name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
        avatar: { base: "body-1", layers: [] },
      }),
    )
    localStorage.setItem("wp:activeQuest:v1:en:es", "es-cafe-travel")
    if (ns) window.__wpCityShadows = false
  }, !!noShadows)
  const q = noShadows ? "?stack=en,es&noshadows" : "?stack=en,es"
  await page.goto(`${url}/${q}`, { waitUntil: "load" })
  for (let i = 0; i < 8; i++) {
    const gone = await page.evaluate(() => !document.querySelector(".wp-entry-root"))
    if (gone) break
    const x = await page.$(".wp-entry-btn")
    if (x) await x.click().catch(() => {})
    await page.waitForTimeout(600)
  }
  await page.waitForFunction(() => !!window.__wpQuest, { timeout: 25000 })
  await page.waitForTimeout(3800) // chunks build + shadow map warms
}

const errs = []
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
page.on("pageerror", (e) => errs.push(String(e)))
await boot(page)
await page.keyboard.press("p") // perf HUD
await page.waitForTimeout(300)
await page.screenshot({ path: "/tmp/wp-cityshadow-boot.png" })

const stats0 = await page.evaluate(() => window.__wpCityShadowStats?.())
console.log("shadow stats @ plaza spawn:", JSON.stringify(stats0))

// WALK far toward the buildings so the streamed façades fill the frame, then read
// the caster count again (should be a BOUNDED near-set, not the whole city).
const walk = async (key, ms) => {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
  await page.waitForTimeout(700)
}
await walk("w", 4200) // stride out of the plaza toward the building ring
const statsFar = await page.evaluate(() => window.__wpCityShadowStats?.())
console.log("shadow stats @ walked-out:", JSON.stringify(statsFar))
await page.screenshot({ path: "/tmp/wp-cityshadow-walkfar.png" })

// Orbit to read shadows raking off the façade bases from two sides.
const orbit = async (fromX, dx, n) => {
  await page.mouse.move(fromX, 430)
  await page.mouse.down()
  for (let i = 0; i < n; i++) await page.mouse.move(fromX + i * dx, 430)
  await page.mouse.up()
  await page.waitForTimeout(500)
}
await orbit(820, -16, 18)
await page.screenshot({ path: "/tmp/wp-cityshadow-bldgL.png" })
await orbit(460, 18, 20)
await page.screenshot({ path: "/tmp/wp-cityshadow-bldgR.png" })

const hud = await page.$eval(".wp-perf-hud", (el) => el.textContent).catch(() => "(no hud)")
console.log("PERF (shadows ON):\n" + hud)
console.log("page errors:", errs.length ? errs.slice(0, 5) : "none")
await page.close()

// A/B: shadows OFF — buildings should NOT cast (kill switch verified).
const errs2 = []
const page2 = await browser.newPage({ viewport: { width: 1280, height: 820 } })
page2.on("pageerror", (e) => errs2.push(String(e)))
await boot(page2, { noShadows: true })
const statsOff = await page2.evaluate(() => window.__wpCityShadowStats?.())
console.log("shadow stats (kill switch):", JSON.stringify(statsOff))
await page2.keyboard.down("w")
await page2.waitForTimeout(4200)
await page2.keyboard.up("w")
await page2.waitForTimeout(700)
await page2.screenshot({ path: "/tmp/wp-cityshadow-noshadows.png" })
console.log("noshadows page errors:", errs2.length ? errs2.slice(0, 5) : "none")
await page2.close()

console.log("screenshots: /tmp/wp-cityshadow-{boot,walkfar,bldgL,bldgR,noshadows}.png")
await browser.close()
