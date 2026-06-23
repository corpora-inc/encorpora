/**
 * WebKit verify driver for the Top-HUD (Slice 2). Boots a vite dev server, loads
 * the HUD verify harness at THREE viewports (phone-portrait / tablet / desktop),
 * screenshots the collapsed capsule + place tag and the expanded detail card, and
 * drives the chrome state machine to ASSERT that the top band (capsule + tag) AND
 * the stub pack button RECEDE during dialogue / challenge / menu.
 *
 *   node qa/hud-verify.mjs
 *
 * Screenshots → /tmp/wp-hud-*.png
 */
import { createServer } from "vite"
import { webkit } from "playwright"

const PORT = 5193

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 }, // phone portrait
  { name: "tablet", width: 834, height: 1112 }, // iPad portrait
  { name: "desktop", width: 1440, height: 900 }, // desktop fine-pointer
]

async function main() {
  const server = await createServer({
    root: process.cwd(),
    server: { port: PORT, strictPort: true },
    logLevel: "warn",
  })
  await server.listen()
  const url = `http://localhost:${PORT}/qa/hud-verify.html`
  console.log(`[verify] vite up at ${url}`)

  const browser = await webkit.launch()
  const errors = []
  let failed = false

  for (const vp of VIEWPORTS) {
    // Desktop wants a fine pointer for hover-peek + the "Details" pill.
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.name !== "desktop",
      isMobile: vp.name === "phone",
    })
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[${vp.name}] ${m.text()}`)
    })
    page.on("pageerror", (e) => errors.push(`[${vp.name}] ${String(e)}`))

    await page.goto(url, { waitUntil: "networkidle" })
    await page.waitForSelector(".wp-status", { timeout: 8000 })
    await page.waitForSelector(".wp-placetag", { timeout: 8000 })
    await page.waitForTimeout(450)

    // M0: both anchors must be DESCENDANTS of .wp-overlay (never body).
    const inOverlay = await page.evaluate(() => window.__wpHud.inOverlay())
    if (!inOverlay.capsule || !inOverlay.placeTag) {
      console.error(`[verify][${vp.name}] FAIL: a chrome anchor is not inside .wp-overlay`, inOverlay)
      failed = true
    }

    // Collapsed glance.
    await page.screenshot({ path: `/tmp/wp-hud-${vp.name}-collapsed.png` })
    console.log(`[verify] /tmp/wp-hud-${vp.name}-collapsed.png`)

    // Expand the capsule → the in-overlay detail card.
    await page.evaluate(() => window.__wpHud.expand())
    await page.waitForTimeout(350)
    const cardVisible = await page.locator(".wp-status-detail").isVisible()
    if (!cardVisible) {
      console.error(`[verify][${vp.name}] FAIL: detail card did not reveal on expand`)
      failed = true
    }
    await page.screenshot({ path: `/tmp/wp-hud-${vp.name}-expanded.png` })
    console.log(`[verify] /tmp/wp-hud-${vp.name}-expanded.png`)
    await page.evaluate(() => window.__wpHud.collapse())
    await page.waitForTimeout(300)

    // ── Chrome state machine: assert the band + pack RECEDE on blocking states ──
    const checks = []
    // world → all shown (pack shown).
    await page.evaluate(() => window.__wpHud.setChromeState("world"))
    await page.waitForTimeout(120)
    checks.push(["world", await page.evaluate(() => window.__wpHud.visibility())])

    // focused → band shown, pack DIM.
    await page.evaluate(() => window.__wpHud.setChromeState("focused"))
    await page.waitForTimeout(120)
    checks.push(["focused", await page.evaluate(() => window.__wpHud.visibility())])

    // dialogue → band + pack HIDDEN (the overlap-bug fix).
    await page.evaluate(() => window.__wpHud.setChromeState("dialogue"))
    await page.waitForTimeout(250)
    const dlg = await page.evaluate(() => window.__wpHud.visibility())
    checks.push(["dialogue", dlg])
    if (vp.name === "phone") {
      await page.screenshot({ path: `/tmp/wp-hud-${vp.name}-dialogue.png` })
      console.log(`[verify] /tmp/wp-hud-${vp.name}-dialogue.png (band+pack receded behind NPC window)`)
    }

    // challenge → band + pack HIDDEN.
    await page.evaluate(() => window.__wpHud.setChromeState("challenge"))
    await page.waitForTimeout(120)
    checks.push(["challenge", await page.evaluate(() => window.__wpHud.visibility())])

    // menu → band + pack HIDDEN.
    await page.evaluate(() => window.__wpHud.setChromeState("menu"))
    await page.waitForTimeout(120)
    checks.push(["menu", await page.evaluate(() => window.__wpHud.visibility())])

    // back to world.
    await page.evaluate(() => window.__wpHud.setChromeState("world"))
    await page.waitForTimeout(120)

    // Assert the receding contract.
    for (const [state, vis] of checks) {
      const expectBandHidden = state === "dialogue" || state === "challenge" || state === "menu"
      const expectPack =
        state === "world" ? "shown" : state === "focused" ? "dim" : "hidden"
      const bandHidden = vis.capsule === "hidden" && vis.placeTag === "hidden"
      const bandShown = vis.capsule === "shown" && vis.placeTag === "shown"
      const okBand = expectBandHidden ? bandHidden : bandShown
      const okPack = vis.pack === expectPack
      const ok = okBand && okPack
      console.log(
        `[verify][${vp.name}] ${state}: band=${vis.capsule}/${vis.placeTag} pack=${vis.pack} ${ok ? "✓" : "✗ FAIL"}`,
      )
      if (!ok) failed = true
    }

    await page.close()
  }

  await browser.close()
  await server.close()

  if (errors.length) {
    console.error("[verify] CONSOLE ERRORS:\n" + errors.join("\n"))
    failed = true
  }
  if (failed) {
    console.error("[verify] FAILED")
    process.exit(1)
  }
  console.log("[verify] OK — capsule + place tag + chrome state machine verified across phone/tablet/desktop")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
