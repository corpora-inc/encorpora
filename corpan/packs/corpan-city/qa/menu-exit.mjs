/**
 * Menu + Exit (M0) verification — WebKit/Playwright.
 *
 * Proves the STRUCTURAL fix: the menu, menu button, and exit confirm all mount
 * INSIDE `.wp-overlay` (the host's accepted render surface), NOT on
 * `document.body`. The body-fixed pause modal was the bug — it painted invisible
 * when the Corpán host clipped it. This harness asserts DOM PLACEMENT (the real
 * fix) + the open/close/ESC flow + the exit handshake (embedded `corpan:exit`
 * AND standalone teardown).
 *
 * HARD TRUTH: this runs standalone, which is exactly what hid the bug twice. A
 * standalone PASS proves the structure is correct (in-overlay) and the handshake
 * fires; it CANNOT certify the embedded render. The owner must confirm in the
 * real embedded app on phone+tablet+desktop.
 *
 *   node qa/menu-exit.mjs [http://localhost:5202]
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5202"
const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

const IDENTITY = JSON.stringify({
  name: { playerId: "player-local", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
  avatar: { base: "body-1", layers: [] },
})

async function seedAndBoot(page) {
  await page.addInitScript((id) => {
    localStorage.setItem("wp:identity:v1", id)
  }, IDENTITY)
  await page.goto(base, { waitUntil: "load" })
  // Wait for the world DOM (.wp-overlay) to mount.
  await page.waitForSelector(".wp-overlay", { timeout: 15000 })
  // The menu button mounts after a rAF.
  await page.waitForSelector(".wp-overlay .wp-menu-button", { timeout: 15000 })
}

const browser = await webkit.launch()

// ---------------------------------------------------------------------------
// PASS 1 — desktop 1280×800: button visible, DOM placement, open/ESC, exit.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

  await seedAndBoot(page)

  // (a) menu button is a DESCENDANT of .wp-overlay (not a body child).
  const btnInOverlay = await page.evaluate(
    () => document.querySelector(".wp-overlay .wp-menu-button") !== null,
  )
  const btnNotBodyChild = await page.evaluate(() =>
    Array.from(document.body.children).every((c) => !c.classList.contains("wp-menu-button")),
  )
  assert("menu button is inside .wp-overlay", btnInOverlay)
  assert("menu button is NOT a direct child of document.body", btnNotBodyChild)

  // Button is visible.
  const btnVisible = await page.isVisible(".wp-menu-button")
  assert("menu button is visible", btnVisible)

  // (b) tap the button → the menu panel opens INSIDE .wp-overlay.
  await page.click(".wp-menu-button")
  await page.waitForSelector(".wp-menu.wp-menu--open", { timeout: 4000 })
  await page.waitForTimeout(350)
  const menuInOverlay = await page.evaluate(
    () => document.querySelector(".wp-overlay .wp-menu") !== null,
  )
  const menuNotBodyChild = await page.evaluate(() =>
    Array.from(document.body.children).every((c) => !c.classList.contains("wp-menu")),
  )
  assert("menu panel is inside .wp-overlay", menuInOverlay)
  assert("menu panel is NOT a direct child of document.body", menuNotBodyChild)

  // The element painted at the panel center is the menu (not clipped/behind).
  const centerIsMenu = await page.evaluate(() => {
    const panel = document.querySelector(".wp-menu-panel")
    if (!panel) return false
    const r = panel.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return Boolean(el && el.closest(".wp-menu"))
  })
  assert("menu panel paints at its own center (not clipped)", centerIsMenu)

  // Tabs (Map · Inventory · Quest) present + show "coming soon".
  const tabCount = await page.$$eval("[data-wp-menu-tab]", (els) => els.length)
  assert("menu has 3 section tabs (Map/Inventory/Quest)", tabCount === 3, `got ${tabCount}`)
  const hasComing = await page.evaluate(() => Boolean(document.querySelector(".wp-menu-coming")))
  assert("M0 section shows a 'coming soon' placeholder", hasComing)

  await page.screenshot({ path: "/tmp/wp-menu-desktop.png" })

  // (c) ESC closes the menu.
  await page.keyboard.press("Escape")
  await page.waitForTimeout(350)
  const menuGoneAfterEsc = await page.evaluate(
    () => document.querySelector(".wp-menu.wp-menu--open") === null,
  )
  assert("ESC closes the menu", menuGoneAfterEsc)

  // (d) ESC opens the menu (no dialogue/overlay open → opens menu).
  await page.keyboard.press("Escape")
  await page.waitForSelector(".wp-menu.wp-menu--open", { timeout: 4000 })
  assert("ESC opens the menu", true)

  // (e) EMBEDDED exit handshake: mock host active, listen for corpan:exit.
  await page.evaluate(() => {
    window.__corpanHostActive = true
    window.__wpExitFired = false
    window.addEventListener("corpan:exit", () => {
      window.__wpExitFired = true
    })
  })
  // Leave the Plaza → confirm (inside .wp-overlay) → Leave.
  await page.click("[data-wp-menu-leave]")
  await page.waitForSelector(".wp-confirm-root.wp-confirm-open", { timeout: 4000 })
  await page.waitForTimeout(300)
  const confirmInOverlay = await page.evaluate(
    () => document.querySelector(".wp-overlay .wp-confirm-root") !== null,
  )
  const confirmNotBodyChild = await page.evaluate(() =>
    Array.from(document.body.children).every((c) => !c.classList.contains("wp-confirm-root")),
  )
  assert("exit confirm is inside .wp-overlay", confirmInOverlay)
  assert("exit confirm is NOT a direct child of document.body", confirmNotBodyChild)

  // Confirm "Leave" → corpan:exit fires.
  await page.click("[data-wp-confirm-go]")
  await page.waitForTimeout(300)
  const exitFired = await page.evaluate(() => window.__wpExitFired === true)
  assert("embedded: Leave → confirm → corpan:exit fires", exitFired)

  assert("no page errors (PASS 1)", errors.length === 0, errors.slice(0, 3).join(" | "))
  await page.close()
}

// ---------------------------------------------------------------------------
// PASS 2 — narrow portrait 390×844: touch path + STANDALONE teardown.
// ---------------------------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

  await seedAndBoot(page)

  // Tap (touch) the menu button → menu opens.
  await page.tap(".wp-menu-button")
  await page.waitForSelector(".wp-menu.wp-menu--open", { timeout: 4000 })
  await page.waitForTimeout(350)
  const menuInOverlayP = await page.evaluate(
    () => document.querySelector(".wp-overlay .wp-menu") !== null,
  )
  assert("portrait: tap opens menu inside .wp-overlay", menuInOverlayP)

  await page.screenshot({ path: "/tmp/wp-menu-portrait.png" })

  // STANDALONE teardown: NO host active → Leave runs onStandaloneExit (game
  // disposes → .wp-root removed). Confirm corpan:exit does NOT fire standalone.
  await page.evaluate(() => {
    window.__corpanHostActive = false
    window.__wpExitFired = false
    window.addEventListener("corpan:exit", () => {
      window.__wpExitFired = true
    })
  })
  await page.tap("[data-wp-menu-leave]")
  await page.waitForSelector(".wp-confirm-root.wp-confirm-open", { timeout: 4000 })
  await page.waitForTimeout(250)
  await page.tap("[data-wp-confirm-go]")
  await page.waitForTimeout(500)
  const rootGone = await page.evaluate(() => document.querySelector(".wp-root") === null)
  const exitNotFired = await page.evaluate(() => window.__wpExitFired === false)
  assert("standalone: Leave tears down the game (.wp-root removed)", rootGone)
  assert("standalone: does NOT dispatch corpan:exit", exitNotFired)

  assert("no page errors (PASS 2)", errors.length === 0, errors.slice(0, 3).join(" | "))
  await page.close()
}

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`)
if (failed.length) {
  console.log("FAILED:", failed.map((r) => r.name).join(", "))
  process.exit(1)
}
console.log("Screenshots: /tmp/wp-menu-desktop.png  /tmp/wp-menu-portrait.png")
