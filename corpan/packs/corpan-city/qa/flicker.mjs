/**
 * Z-FIGHT FLICKER PROOF. Holds a FIXED grazing camera angle on the buildings
 * street (the angle that makes coplanar roof/parapet/ground faces fight worst),
 * grabs consecutive frames' pixels straight off the WebGL canvas (via a 2D
 * readback inside the page), and counts pixels that HARD-FLIP frame-to-frame in
 * a static ROOF crop. Z-fighting = a hard surface swap with nothing moving.
 * The atmosphere's animated motes/vignette are excluded by cropping to roofs.
 */
import { webkit } from "playwright"

const url = (process.argv[2] ?? "http://localhost:5174") + "/qa/buildings.html"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(2500)

// Grazing angle along the rooftops — worst case for coplanar faces.
await page.evaluate(() => window.__wpBuildings.setAngle(Math.PI * 0.6, 1.24, 20))
await page.waitForTimeout(600)
await page.screenshot({ path: "/tmp/wp-flicker-view.png" })

// Read a ROOF-band crop (upper-middle of frame) off the canvas as raw RGBA.
const grab = () =>
  page.evaluate(() => {
    const cv = document.getElementById("wp-canvas")
    const oc = document.createElement("canvas")
    // crop band: x 280..1000, y 200..430 (rooftops sit here at this angle)
    const sx = 280, sy = 200, sw = 720, sh = 230
    oc.width = sw
    oc.height = sh
    const ctx = oc.getContext("2d")
    ctx.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh)
    return Array.from(ctx.getImageData(0, 0, sw, sh).data)
  })

const frames = []
for (let i = 0; i < 6; i++) {
  frames.push(await grab())
  await page.waitForTimeout(60)
}

const n = frames[0].length / 4
function hardFlips(a, b) {
  let c = 0
  for (let p = 0; p < n; p++) {
    const i = p * 4
    const la = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]
    const lb = 0.3 * b[i] + 0.59 * b[i + 1] + 0.11 * b[i + 2]
    if (Math.abs(la - lb) > 60) c++
  }
  return c
}
let worst = 0
for (let i = 1; i < frames.length; i++) worst = Math.max(worst, hardFlips(frames[i - 1], frames[i]))
console.log(`roof-crop hard-flip pixels (worst pair): ${worst} / ${n}  (${((worst / n) * 100).toFixed(3)}%)`)
const stats = await page.evaluate(() => window.__wpBuildings.stats())
console.log("stats:", JSON.stringify(stats))
console.log("errors:", errors.length ? errors.slice(0, 3) : "none")
console.log(worst / n < 0.003 ? "PASS: no z-fight flicker in roof band" : "FAIL: flicker detected")
await browser.close()
