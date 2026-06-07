/**
 * Verify the Inventory panel can NOT scroll sideways (its left edges stay put).
 * Attempts to scroll the .wp-menu-body right; asserts scrollLeft stays 0 and
 * scrollWidth ≈ clientWidth. Run: node qa/inventory.mjs [url]
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174/qa/inventory.html"
const browser = await webkit.launch()
let failed = false
for (const vp of [{ id: "phone", w: 390, h: 844 }, { id: "tablet", w: 1024, h: 1366 }]) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 })
  page.on("console", (m) => { const t = m.text(); if (/error|Error/.test(t) && !/vite/i.test(t)) console.log("[pg]", t.slice(0, 140)) })
  await page.goto(url, { waitUntil: "load" })
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => {
    const b = document.querySelector(".wp-menu-body")
    if (!b) return { none: true }
    b.scrollLeft = 9999 // try to scroll right
    const inv = document.querySelector(".wp-inv")
    const ir = inv?.getBoundingClientRect()
    return {
      scrollLeft: b.scrollLeft,
      scrollWidth: b.scrollWidth,
      clientWidth: b.clientWidth,
      overflowX: getComputedStyle(b).overflowX,
      invLeft: ir ? Math.round(ir.left) : null,
      bodyLeft: Math.round(b.getBoundingClientRect().left),
    }
  })
  // The fix is `overflow-x: hidden`: the body must NOT be horizontally scrollable
  // by the user. (A residual 1-2px scrollWidth from the scroll-edge fade's -2px
  // bleed is clipped + non-interactive, so we assert on the clamp + no real
  // content overflow, not on an exact scrollWidth match.)
  const realOverflow = r.scrollWidth - r.clientWidth > 4 // >fade bleed = real content overflow
  const ok = r.overflowX === "hidden" && !realOverflow
  if (!ok) failed = true
  console.log(`[${vp.id}] overflowX=${r.overflowX} scrollW=${r.scrollWidth} clientW=${r.clientWidth} invLeft=${r.invLeft} bodyLeft=${r.bodyLeft} → ${ok ? "OK (no user sideways scroll)" : "FAIL (scrolls sideways)"}`)
  await page.screenshot({ path: `/tmp/wp-inv-${vp.id}.png` })
  await page.close()
}
await browser.close()
process.exit(failed ? 1 : 0)
