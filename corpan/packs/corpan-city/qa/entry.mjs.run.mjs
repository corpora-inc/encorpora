/**
 * Playwright driver for the entry harness. Verifies derivation + reactivity and
 * screenshots the chooser + welcome to /tmp/wp-entry-*.png.
 *
 * Each `run()` is kicked off WITHOUT awaiting in-page (we don't hold a cross-call
 * evaluate handle — that races the click-driven resolution). We drive the UI,
 * then read the resolved pair via `__wpEntry.lastPair()`.
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174/qa/entry.html"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text())
})

await page.goto(url, { waitUntil: "load" })
await page.waitForFunction(() => window.__wpEntryReady === true, { timeout: 8000 })

const results = {}
const sleep = (ms) => page.waitForTimeout(ms)

// Kick a run in-page; it resolves when we click through. We DON'T await it here.
const kick = (langs, opts) =>
  page.evaluate(([l, o]) => void window.__wpEntry.run(l, o), [langs, opts ?? {}])

// ── 1. MULTI-TARGET: EN primary, studying ES + FR + JA → chooser ─────────────
await kick(["en", "es", "fr", "ja"])
await page.waitForSelector(".wp-entry-langs .wp-entry-lang", { timeout: 5000 })
await sleep(500)
await page.screenshot({ path: "/tmp/wp-entry-chooser.png" })
results.chooserTiles = await page.$$eval(".wp-entry-lang__native", (ns) =>
  ns.map((n) => n.textContent),
)
await page.click('.wp-entry-lang[aria-label="Play in French"]')
await page.waitForSelector(".wp-entry-btn", { timeout: 5000 })
await sleep(500)
await page.screenshot({ path: "/tmp/wp-entry-welcome.png" })
await page.click(".wp-entry-btn")
await page.waitForFunction(() => window.__wpEntry.lastPair()?.target === "fr", { timeout: 5000 })
results.multi = await page.evaluate(() => window.__wpEntry.lastPair())

// ── 2. SINGLE-TARGET: EN primary, studying ES → no chooser, welcome ──────────
await kick(["en", "es"])
await page.waitForSelector(".wp-entry-btn", { timeout: 5000 })
results.singleTargetHadChooser = !!(await page.$(".wp-entry-langs"))
await page.click(".wp-entry-btn")
await page.waitForFunction(() => window.__wpEntry.lastPair()?.target === "es" && window.__wpEntry.lastPair()?.native === "en", { timeout: 5000 })
results.singleTarget = await page.evaluate(() => window.__wpEntry.lastPair())

// ── 2b. FLIPPED: ES primary, studying EN (the bug) → EN-from-ES ──────────────
await kick(["es", "en"])
await page.waitForSelector(".wp-entry-btn", { timeout: 5000 })
await sleep(400)
await page.screenshot({ path: "/tmp/wp-entry-welcome-flipped.png" })
await page.click(".wp-entry-btn")
await page.waitForFunction(() => window.__wpEntry.lastPair()?.target === "en" && window.__wpEntry.lastPair()?.native === "es", { timeout: 5000 })
results.flipped = await page.evaluate(() => window.__wpEntry.lastPair())

// ── 3. SINGLE-LANGUAGE: just ES → immersion pair (target===native) ───────────
await kick(["es"])
await page.waitForSelector(".wp-entry-btn", { timeout: 5000 })
results.immersionHadChooser = !!(await page.$(".wp-entry-langs"))
await sleep(300)
await page.screenshot({ path: "/tmp/wp-entry-welcome-immersion.png" })
await page.click(".wp-entry-btn")
await page.waitForFunction(() => window.__wpEntry.lastPair()?.target === "es" && window.__wpEntry.lastPair()?.native === "es", { timeout: 5000 })
results.immersion = await page.evaluate(() => window.__wpEntry.lastPair())

// ── 4. REACTIVITY: EN-from-ES, flip to ES-from-EN → fires new pair ───────────
results.reactiveFires = await page.evaluate(() =>
  window.__wpEntry.testReactivity(["en", "es"], ["es", "en"]),
)

// ── 5. silent re-resolve (no UI) → default pair for new stack ────────────────
results.silent = await page.evaluate(() => {
  // silent path resolves synchronously w.r.t. UI (no clicks); await via promise.
  return window.__wpEntry.run(["es", "en", "fr"], { silent: true }).then((r) => r.learnerPair)
})

await browser.close()

console.log("RESULTS:", JSON.stringify(results, null, 2))
if (errors.length) console.error("PAGE ERRORS:", errors)

const ok = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg)
    process.exitCode = 1
  } else console.log("ok:", msg)
}
ok(results.chooserTiles?.length === 3, "chooser shows 3 study languages")
ok(results.multi?.target === "fr" && results.multi?.native === "en", "multi pick → fr-from-en")
ok(results.singleTargetHadChooser === false, "single-target: NO chooser")
ok(results.singleTarget?.target === "es" && results.singleTarget?.native === "en", "single → es-from-en")
ok(results.flipped?.target === "en" && results.flipped?.native === "es", "flipped → en-from-es (bug fixed)")
ok(results.immersionHadChooser === false, "single-language: NO chooser")
ok(results.immersion?.target === "es" && results.immersion?.native === "es", "single-language → immersion (es/es)")
ok(results.reactiveFires?.length === 1, "reactivity fires once on flip")
ok(
  results.reactiveFires?.[0]?.target === "en" && results.reactiveFires?.[0]?.native === "es",
  "reactive flip → en-from-es",
)
ok(results.silent?.target === "en" && results.silent?.native === "es", "silent → first target en-from-es")
if (errors.length) process.exitCode = 1
