/**
 * Character gallery — renders a grid of generated CharacterSpecs to one canvas
 * to prove INFINITE non-repetitive variety + the layered paper-doll art at
 * close range. Screenshot → /tmp/wp-people-gallery.png
 */
import { webkit } from "playwright"

const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 760 } })
await page.goto("http://localhost:5174/qa/people.html", { waitUntil: "load" })
await page.waitForTimeout(800)

// Use the live bundle's modules via a dynamic import in page context.
await page.evaluate(async () => {
  const gen = await import("/src/character/characterGen.ts")
  const art = await import("/src/character/characterArt.ts")
  const roles = ["vendor", "npc_station", "cafe_counter", "tailor", "traveler", "crowd"]
  const cols = 8
  const rows = 5
  const cw = 130
  const ch = 150
  const cv = document.createElement("canvas")
  cv.width = cols * cw
  cv.height = rows * ch
  cv.style.cssText = "position:absolute;inset:0;z-index:9999;background:#efe7d6"
  document.body.appendChild(cv)
  const ctx = cv.getContext("2d")
  let n = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const role = roles[n % roles.length]
      const spec = gen.generateCharacter(role, "gallery:" + n, gen.ANTIGUA_1770)
      // draw into an offscreen char-tex then blit scaled
      const off = document.createElement("canvas")
      off.width = art.CHAR_TEX.w
      off.height = art.CHAR_TEX.h
      const octx = off.getContext("2d")
      art.characterDraw(spec, { mouth: n % 3 === 0 ? 0.7 : 0, rightArm: n % 5 === 0 ? 1 : 0 })(
        octx, off.width, off.height,
      )
      ctx.drawImage(off, c * cw + 8, r * ch + 4, cw - 16, ch - 8)
      n++
    }
  }
  ;(window).__galleryReady = true
})
await page.waitForFunction(() => window.__galleryReady === true)
await page.waitForTimeout(200)
await page.screenshot({ path: "/tmp/wp-people-gallery.png" })
console.log("gallery saved")
await browser.close()
