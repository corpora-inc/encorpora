/**
 * Shop / items / economy self-verification (WebKit).
 *
 * Proves the items+inventory+economy stack end-to-end through the REAL modules:
 *   1. seed an inventory (coins + items + a hat)
 *   2. apply a sample challenge reward (xp + coins + ferry-token + cacao)
 *   3. open the grocer shop and BUY a straw hat (coins flow out)
 *   4. SELL a trade-good (coins flow in)
 *   5. EQUIP a cosmetic (avatar layer updates)
 *   6. assert quest-relevance ("ferry-token" precious on guadalajara, junk on cafe)
 * and screenshots each step to /tmp/wp-shop-*.png.
 *
 * Health guarantees: NO QuotaExceededError, NO layout shift of the HUD across
 * shop open/close (overlay is position:fixed + compositor-only).
 *
 *   node qa/shop.mjs [http://localhost:5174]
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}
const sameBox = (a, b) =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5

const page = await browser.newPage({ viewport: { width: 430, height: 880 }, hasTouch: true })
const errors = []
const quotaErrors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  const t = m.text()
  if (m.type() === "error") errors.push(t)
  if (/quota/i.test(t)) quotaErrors.push(t)
})

await page.goto(`${base}/qa/shop.html`, { waitUntil: "load" })
await page.waitForFunction(() => !!window.__wpEco, null, { timeout: 8000 })

const eco = (fn, ...args) => page.evaluate(([f, a]) => window.__wpEco[f](...a), [fn, args])

// --- 1. seed --------------------------------------------------------------
await eco("seed")
let state = await eco("state")
assert("seed: coins=120 xp=40", state.coins === 120 && state.xp === 40, JSON.stringify(state))
assert("seed: bag has cinnamon×3 + coffee + hat", state.bag.length === 3, JSON.stringify(state.bag))
// Measure the #app ROOT (full-viewport, fixed) for layout-shift — NOT the HUD,
// whose width legitimately changes as the coin/xp digits change. The overlay
// mounting must not move the root by a pixel.
const hudBox = () => page.$eval("#app", (el) => el.getBoundingClientRect().toJSON())
const baselineHud = await hudBox()
await page.screenshot({ path: "/tmp/wp-shop-1-seeded.png" })

// --- 2. apply a sample challenge reward -----------------------------------
const granted = await eco("applySampleReward")
state = await eco("state")
assert(
  "applyReward: +30 coins, +25 xp, granted ferry-token + cacao",
  state.coins === 150 && state.xp === 65 && granted.includes("ferry-token"),
  `coins=${state.coins} xp=${state.xp} granted=${JSON.stringify(granted)}`,
)
await page.screenshot({ path: "/tmp/wp-shop-2-reward.png" })

// --- 3. open the grocer shop (no layout shift) ----------------------------
const beforeOpen = await baselineHud
await eco("openShop", "grocer", "es-guadalajara-route")
await page.waitForTimeout(16) // danger frame
const openFrame = await hudBox()
await page.waitForSelector(".wp-shop--in", { timeout: 4000 })
await page.waitForTimeout(450)
const openSettled = await hudBox()
assert(
  "shop open: HUD does NOT move (overlay out-of-flow)",
  sameBox(beforeOpen, openFrame) && sameBox(beforeOpen, openSettled),
  `before=${JSON.stringify(beforeOpen)} frame=${JSON.stringify(openFrame)}`,
)
await page.screenshot({ path: "/tmp/wp-shop-3-grocer-buy.png" })

// switch to the tailor for the hat (grocer doesn't sell hats); reopen.
await page.click(".wp-shop-close")
await page.waitForTimeout(420)
await eco("openShop", "tailor", "es-guadalajara-route")
await page.waitForSelector(".wp-shop--in", { timeout: 4000 })
await page.waitForTimeout(300)

// --- 3b. BUY a hat (tricorn) ---------------------------------------------
const coinsBeforeBuy = (await eco("state")).coins
// select the tricorn hat cell by its name, then Buy.
await page.locator(".wp-shop-cell", { hasText: "Tricorn Hat" }).first().click()
await page.waitForTimeout(120)
await page.locator(".wp-shop-btn--buy").click()
await page.waitForTimeout(150)
state = await eco("state")
assert(
  "buy: coins dropped by 80 and tricorn-hat owned",
  state.coins === coinsBeforeBuy - 80 && state.bag.some((b) => b.id === "tricorn-hat"),
  `coins ${coinsBeforeBuy}→${state.coins} bag=${JSON.stringify(state.bag.map((b) => b.id))}`,
)
await page.screenshot({ path: "/tmp/wp-shop-4-bought-hat.png" })

// --- 4. SELL a trade-good (cinnamon) -------------------------------------
await page.click(".wp-shop-tab:has-text('Sell')")
await page.waitForTimeout(150)
const coinsBeforeSell = (await eco("state")).coins
await page.locator(".wp-shop-cell", { hasText: "Cinnamon" }).first().click()
await page.waitForTimeout(120)
await page.locator(".wp-shop-btn--sell").click()
await page.waitForTimeout(150)
state = await eco("state")
assert(
  "sell: cinnamon qty dropped, coins rose",
  state.coins > coinsBeforeSell &&
    (state.bag.find((b) => b.id === "spices-cinnamon")?.qty ?? 0) === 2,
  `coins ${coinsBeforeSell}→${state.coins}`,
)
await page.screenshot({ path: "/tmp/wp-shop-5-sold-good.png" })

// --- 5. EQUIP a cosmetic (the hat we own) --------------------------------
await page.click(".wp-shop-tab:has-text('Sell')") // stay on a tab that lists the bag
await page.waitForTimeout(100)
await page.locator(".wp-shop-cell", { hasText: "Straw Hat" }).first().click()
await page.waitForTimeout(120)
await page.locator(".wp-shop-btn--equip").click()
await page.waitForTimeout(150)
state = await eco("state")
assert(
  "equip: straw-hat is in equipped.hat",
  state.equipped?.hat?.itemId === "straw-hat",
  JSON.stringify(state.equipped),
)
await page.screenshot({ path: "/tmp/wp-shop-6-equipped.png" })

// close (no layout shift on close either)
const beforeClose = await hudBox()
await page.click(".wp-shop-close")
await page.waitForTimeout(16)
const closeFrame = await hudBox()
await page.waitForTimeout(450)
const afterClose = await hudBox()
assert(
  "shop close: HUD does NOT move",
  sameBox(beforeClose, closeFrame) && sameBox(beforeClose, afterClose),
  "",
)

// --- 6. quest-relevance (the spice) --------------------------------------
const relFerryGuad = await eco("relevance", "es-guadalajara-route", "ferry-token")
const relFerryCafe = await eco("relevance", "es-cafe-travel", "ferry-token")
assert(
  "quest-relevance: ferry-token required on guadalajara, junk on cafe",
  relFerryGuad === "required" && relFerryCafe === "junk",
  `guad=${relFerryGuad} cafe=${relFerryCafe}`,
)
const needed = await eco("hasNeeded", "es-guadalajara-route", "docks")
assert("quest-gate: hasNeeded(docks) true (we hold ferry-token)", needed === true, String(needed))

// --- health ---------------------------------------------------------------
assert("NO QuotaExceededError anywhere", quotaErrors.length === 0, quotaErrors.slice(0, 2).join(" | "))
assert("no uncaught page errors", errors.length === 0, errors.slice(0, 3).join(" | "))

await page.close()
await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
console.log("screenshots: /tmp/wp-shop-1..6-*.png")
process.exit(failed.length === 0 ? 0 : 1)
