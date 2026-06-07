/**
 * Faces QA — the CONTENT_SCALE §1 face-kit quality gate.
 *   • a 64-face CONTACT SHEET reads as a friendly, distinct, mixed crowd
 *   • asymmetric (smirk/sneer) faces stay a small minority (ratio reported)
 *   • the parametric AXES are actually exercised (eye/face/age/nose coverage +
 *     a large distinct-combo count → no twins at any plaza size)
 *   • the SAME face renders under every MOOD_BEAT (mood→emotion channel), all
 *     wholesome (no sneer in any mood)
 *   • a talking NPC's mouth opens/closes across frames (sampled + screenshotted)
 * Screenshots → /tmp/wp-faces-*.png
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174/qa/faces.html"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push("console: " + m.text())
})

await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(700)

// --- full contact-sheet overview ---
await page.screenshot({ path: "/tmp/wp-faces-gallery.png", fullPage: true })

const data = await page.evaluate(() => window.__wpFaces ?? null)

// --- focused screenshots of each panel for human sign-off ---
// the contact sheet is the first big grid; capture the top region tightly too.
await page.screenshot({ path: "/tmp/wp-faces-contact-sheet.png", clip: { x: 0, y: 0, width: 1000, height: 900 } }).catch(() => {})

// --- talking mouth across several frames ---
const mouthSamples = []
for (let i = 0; i < 8; i++) {
  const m = await page.evaluate(() => window.__wpFaces?.talkMouth() ?? 0)
  mouthSamples.push(Number(m.toFixed(3)))
  await page.waitForTimeout(110)
}
await page.screenshot({ path: "/tmp/wp-faces-talk-open.png", fullPage: true })

const mouthMin = Math.min(...mouthSamples)
const mouthMax = Math.max(...mouthSamples)

const moods = data?.moods ?? []
const moodSneer = moods.filter((m) => m.emotion === "sneer").length

console.log("=== FACES QA (face kit §1) ===")
console.log("contact sheet faces:", data?.count)
console.log("shown expression tally:", JSON.stringify(data?.tally))
console.log(`shown asymmetric (smirk/sneer): ${data?.asymmetric}/${data?.count}` +
  ` = ${(100 * (data?.asymmetricRatio ?? 0)).toFixed(1)}%`)
console.log(`BIG sample (${data?.bigSample}) asymmetric ratio: ` +
  `${data?.bigAsymmetric}/${data?.bigSample} = ${(100 * (data?.bigAsymmetricRatio ?? 0)).toFixed(1)}%`)
console.log("big tally:", JSON.stringify(data?.bigTally))
console.log("axis coverage:", JSON.stringify(data?.axes))
console.log("mood→emotion map:", moods.map((m) => `${m.beat.slice(0, 14)}…→${m.emotion}`).join("  "))
console.log("mood emotions that are a sneer:", moodSneer, "(must be 0)")
console.log("talk mouth samples:", mouthSamples.join(", "))
console.log(`talk mouth range: ${mouthMin} .. ${mouthMax} (Δ ${(mouthMax - mouthMin).toFixed(3)})`)
console.log("page errors:", errors.length ? errors.slice(0, 6) : "none")

const ax = data?.axes ?? {}
const ok =
  data?.count === 64 &&
  (data?.bigAsymmetricRatio ?? 1) < 0.12 && // smirk/sneer a small minority
  ax.eyeShapes >= 5 && ax.faceShapes >= 5 && ax.ageBands >= 4 && ax.noseStyles >= 5 &&
  (ax.distinctCombos ?? 0) >= 200 && // rich combinatorial variety
  moodSneer === 0 && // no mood ever yields a sneer
  mouthMax - mouthMin > 0.25 && // mouth visibly opens & closes
  errors.length === 0
console.log(ok ? "RESULT: PASS" : "RESULT: CHECK (see above)")

await browser.close()
