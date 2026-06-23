/**
 * Drive the wardrobe harness: screenshot the 3D portrait + report the chip rows
 * per category (to prove the dedupe: exactly ONE "None"-class chip per slot).
 * Run: node qa/wardrobe.mjs [url]
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174/qa/wardrobe.html"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 })
page.on("console", (m) => console.log("[page]", m.text()))
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2500)

// Report the chip rows. For each starter group, list chip labels — there must be
// exactly one "None"-class chip (the localized None), never a "None"+"No Hat" dup.
const groups = await page.evaluate(() => {
  const out = []
  for (const g of Array.from(document.querySelectorAll(".wp-wardrobe-group"))) {
    const label = g.querySelector(".wp-wardrobe-group-label")?.textContent ?? ""
    const chips = Array.from(g.querySelectorAll(".wp-wardrobe-chip")).map((c) => c.textContent)
    out.push({ label, chips })
  }
  return out
})
console.log("=== wardrobe groups ===")
for (const g of groups) console.log(g.label, "→", JSON.stringify(g.chips))

const figVisible = await page.evaluate(() => {
  const c = document.querySelector(".wp-wardrobe-fig")
  if (!c) return "no-canvas"
  const cs = getComputedStyle(c)
  return cs.display === "none" ? "hidden(2D-fallback)" : "visible(3D)"
})
console.log("3D portrait:", figVisible)

await page.screenshot({ path: "/tmp/wp-wardrobe.png" })
await browser.close()
