/**
 * Horizontal-overflow scanner. Walks the onboarding flow (and optionally the
 * wardrobe / challenge overlays) and reports every element whose scrollWidth
 * exceeds its clientWidth (a sideways-scroll culprit) plus any element wider
 * than the viewport. Phone viewport (390px) is the worst case.
 *
 * Run: node qa/overflow-scan.mjs [url]
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()

const scan = async (page, label) => {
  const culprits = await page.evaluate(() => {
    const out = []
    const vw = document.documentElement.clientWidth
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const sw = el.scrollWidth
      const cw = el.clientWidth
      const r = el.getBoundingClientRect()
      const overflowsSelf = sw - cw > 2 && getComputedStyle(el).overflowX !== "visible"
      const wider = r.width - vw > 2
      const rightBleed = r.right - vw > 2
      const leftBleed = r.left < -2
      if (overflowsSelf || wider || rightBleed || leftBleed) {
        out.push({
          cls: (el.className && el.className.toString) ? el.className.toString().slice(0, 60) : "",
          tag: el.tagName.toLowerCase(),
          sw, cw, vw,
          left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
          ox: getComputedStyle(el).overflowX,
        })
      }
    }
    return out
  })
  console.log(`\n=== ${label} (overflow-x culprits: ${culprits.length}) ===`)
  for (const c of culprits) console.log(JSON.stringify(c))
  return culprits
}

const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.addInitScript(() => localStorage.clear())
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(1500)

// step through onboarding screens, scanning each
for (let i = 0; i < 8; i++) {
  await scan(page, `onboarding-step-${i}`)
  await page.screenshot({ path: `/tmp/wp-onb-${i}.png` })
  // advance: click any primary/ghost/enter button
  const advanced = await page.evaluate(() => {
    const btn =
      document.querySelector(".wp-onb-btn--primary") ||
      document.querySelector(".wp-onb-btn--enter") ||
      document.querySelector(".wp-onb-btn")
    if (btn) { btn.click(); return true }
    return false
  })
  await page.waitForTimeout(900)
  if (!advanced) break
}

await browser.close()
