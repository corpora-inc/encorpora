/**
 * WebKit verify driver for the Badges slice. Boots a vite dev server, loads the
 * Badge Case verify harness, screenshots the case + HUD chip, triggers a tier-up,
 * and screenshots again. Tears everything down.
 *
 *   node qa/badges-verify.mjs
 *
 * Screenshots → /tmp/wp-badge-case.png, /tmp/wp-badge-chip.png, /tmp/wp-badge-tierup.png
 */
import { createServer } from "vite"
import { webkit } from "playwright"

const PORT = 5191

async function main() {
  const server = await createServer({
    root: process.cwd(),
    server: { port: PORT, strictPort: true },
    logLevel: "warn",
  })
  await server.listen()
  const url = `http://localhost:${PORT}/qa/badges-verify.html`
  console.log(`[verify] vite up at ${url}`)

  const browser = await webkit.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 760 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(String(e)))

  await page.goto(url, { waitUntil: "networkidle" })
  await page.waitForSelector(".wp-badges-grid .wp-badge-cell", { timeout: 8000 })
  await page.waitForTimeout(400)

  // The Badge Case (menu section).
  const stage = page.locator(".wp-menu-stage")
  await stage.screenshot({ path: "/tmp/wp-badge-case.png" })
  console.log("[verify] /tmp/wp-badge-case.png")

  // The HUD focus chip.
  const chip = page.locator(".wp-focusbadge")
  await chip.screenshot({ path: "/tmp/wp-badge-chip.png" })
  const chipLabel = await chip.locator(".wp-focusbadge-label").textContent()
  console.log("[verify] focus chip label:", JSON.stringify(chipLabel))

  // Read the focus glance + mastered count.
  const focus = await page.evaluate(() => window.__wpBadges.focus())
  console.log("[verify] focusBadge():", JSON.stringify(focus))

  // Trigger a tier-up and screenshot the filled case + the chip pip.
  await page.evaluate(() => window.__wpBadges.tierUp())
  await page.waitForTimeout(500)
  await stage.screenshot({ path: "/tmp/wp-badge-tierup.png" })
  console.log("[verify] /tmp/wp-badge-tierup.png")

  // Click a medal to open the detail panel, screenshot.
  await page.locator(".wp-badge-cell").first().click()
  await page.waitForTimeout(300)
  await stage.screenshot({ path: "/tmp/wp-badge-detail.png" })
  console.log("[verify] /tmp/wp-badge-detail.png")

  const masteredAfter = await page.evaluate(() => window.__wpBadges.mastered())
  console.log("[verify] mastered count:", masteredAfter)

  // Verify the case is a DESCENDANT of .wp-overlay (the M0 rule, never body).
  const inOverlay = await page.evaluate(() => {
    const c = document.querySelector(".wp-badges")
    const ov = document.querySelector(".wp-overlay")
    return !!(c && ov && ov.contains(c))
  })
  console.log("[verify] .wp-badges inside .wp-overlay:", inOverlay)

  await browser.close()
  await server.close()

  if (errors.length) {
    console.error("[verify] CONSOLE ERRORS:\n" + errors.join("\n"))
    process.exit(1)
  }
  if (!inOverlay) {
    console.error("[verify] FAIL: Badge Case not inside .wp-overlay")
    process.exit(1)
  }
  console.log("[verify] OK")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
