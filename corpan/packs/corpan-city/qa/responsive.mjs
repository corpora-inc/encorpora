/**
 * Responsive visual verification across 4 first-class viewports.
 * For each viewport:
 *   (a) fresh load → screenshot onboarding
 *   (b) seed identity → world → walk to an NPC → open dialogue → screenshot
 * Saves to /tmp/wp-resp-<viewport>-<screen>.png
 *
 * Usage: node qa/responsive.mjs [url]
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"

const VIEWPORTS = [
  { id: "phone", width: 390, height: 844 }, // small phone portrait (iPhone 13/14)
  { id: "ipad-portrait", width: 1024, height: 1366 }, // big iPad portrait
  { id: "ipad-landscape", width: 1366, height: 1024 }, // big iPad landscape
  { id: "desktop", width: 1680, height: 1050 }, // large desktop
]

const IDENTITY = JSON.stringify({
  name: { playerId: "player-local", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
  avatar: { base: "body-1", layers: [] },
})

const browser = await webkit.launch()

for (const vp of VIEWPORTS) {
  // ---- (a) onboarding ----
  const a = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
  await a.context().clearCookies()
  await a.addInitScript(() => localStorage.clear())
  await a.goto(url, { waitUntil: "load" })
  await a.waitForTimeout(2000)
  await a.screenshot({ path: `/tmp/wp-resp-${vp.id}-onboarding.png` })
  const onbVisible = await a.$("[class^='wp-onb']").then((el) => !!el).catch(() => false)
  await a.close()

  // ---- (b) world + dialogue ----
  const b = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
  await b.addInitScript((id) => localStorage.setItem("wp:identity:v1", id), IDENTITY)
  await b.goto(url, { waitUntil: "load" })
  await b.waitForTimeout(2200)
  await b.screenshot({ path: `/tmp/wp-resp-${vp.id}-world.png` })

  // walk toward an NPC, then engage
  await b.keyboard.down("d")
  await b.waitForTimeout(2300)
  await b.keyboard.up("d")
  await b.waitForTimeout(350)
  const btn = await b.$(".wp-interact")
  const btnVisible = btn ? await btn.evaluate((el) => el.style.display !== "none") : false
  if (btnVisible) await b.click(".wp-interact").catch(() => {})
  await b.waitForTimeout(2800) // let the mock LLM stream
  await b.screenshot({ path: `/tmp/wp-resp-${vp.id}-dialogue.png` })
  const dialogue = await b.$("[class^='wp-npc']").then((el) => !!el).catch(() => false)
  await b.close()

  console.log(
    `[${vp.id} ${vp.width}x${vp.height}] onboarding=${onbVisible} talkBtn=${btnVisible} dialogue=${dialogue}`,
  )
}

await browser.close()
console.log("\nScreenshots in /tmp/wp-resp-*.png")
