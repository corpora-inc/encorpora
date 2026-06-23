/**
 * Screenshots the Corpan City onboarding flow (welcome → name → avatar) in
 * WebKit (≈ the macOS/iOS WKWebView the pack ships in). The flow is mounted
 * standalone via a dynamic import of the onboarding module — it does NOT touch
 * game.ts, so this runs against the same dev server the game uses.
 *
 * Usage: node qa/onboarding.mjs [url]
 * Output: /tmp/wp-onb-welcome.png, -name.png, -avatar.png
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const shot = (n) => `/tmp/wp-onb-${n}.png`

const browser = await webkit.launch()
// phone-ish portrait viewport — onboarding is mobile-first
const page = await browser.newPage({ viewport: { width: 414, height: 820 } })

const errors = []
const logs = []
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`))
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto(url, { waitUntil: "load" })

// Mount onboarding over a clean host. We clear the dev game root first so the
// only thing on screen is the onboarding card.
const result = await page.evaluate(async () => {
  document.querySelectorAll(".wp-root").forEach((n) => n.remove())
  const host = document.createElement("div")
  host.id = "wp-onb-host-test"
  host.style.cssText = "position:absolute;inset:0;background:#bfe0e8"
  document.body.appendChild(host)
  const mod = await import("/src/onboarding/onboarding.ts")
  // expose a manual driver and the promise result
  window.__onb = {}
  const p = mod
    .runOnboarding(host, { playerId: "qa-player" })
    .then((r) => {
      window.__onb.result = r
    })
  window.__onb.pending = p
  return "mounted"
})
console.log("mount:", result)
await page.waitForTimeout(700)

// --- step 0: welcome ---
await page.waitForSelector(".wp-onb-card", { timeout: 4000 })
await page.screenshot({ path: shot("welcome") })

// advance: Begin
await page.click(".wp-onb-btn--primary")
await page.waitForTimeout(500)

// --- step 1: name roller ---
await page.waitForSelector(".wp-onb-name", { timeout: 3000 })
const firstName = await page.$eval(".wp-onb-name", (el) => el.textContent)
await page.screenshot({ path: shot("name") })
// reroll once and confirm it still shows a name
await page.click(".wp-onb-btn--ghost")
await page.waitForTimeout(700)
const rerolled = await page.$eval(".wp-onb-name", (el) => el.textContent)
await page.screenshot({ path: shot("name-rerolled") })

// advance: Use this name
await page.click(".wp-onb-btn--primary")
await page.waitForTimeout(500)

// --- step 2: dress-up ---
await page.waitForSelector(".wp-onb-doll", { timeout: 3000 })
await page.screenshot({ path: shot("avatar") })

// poke a couple of cosmetics + a tint, screenshot the change
const hatChips = await page.$$(".wp-onb-chip")
if (hatChips.length > 3) await hatChips[3].click()
await page.waitForTimeout(150)
const tints = await page.$$(".wp-onb-tint")
if (tints.length > 1) await tints[1].click()
await page.waitForTimeout(200)
await page.screenshot({ path: shot("avatar-dressed") })

// --- enter the plaza: resolves the promise ---
await page.click(".wp-onb-btn--enter")
await page.waitForTimeout(600)

const out = await page.evaluate(() => window.__onb?.result ?? null)

console.log("first name:", firstName)
console.log("rerolled name:", rerolled, rerolled !== firstName ? "(changed)" : "(same — chance)")
console.log("resolved identity:", out?.name?.displayName)
console.log("resolved avatar layers:", out?.avatar?.layers?.map((l) => `${l.slot}:${l.itemId}`).join(", "))
console.log("CONSOLE ERRORS:", errors.length ? errors : "none")
const warnish = logs.filter((l) => l.startsWith("error") || l.startsWith("warning"))
console.log("CONSOLE error/warn:", warnish.length ? warnish : "none")

await browser.close()
if (!out) {
  console.error("FAIL: onboarding did not resolve a result")
  process.exit(1)
}
