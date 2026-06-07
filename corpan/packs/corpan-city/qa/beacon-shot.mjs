/**
 * #22 — capture the premium objective beacon over the objective NPC.
 *
 * Boots the real game on the entry quest (es-cafe, objective NPC at the plaza
 * where you spawn), teleports the player to the objective so the beacon's NPC is
 * in frame, and screenshots. Visual proof the beacon is a designed warm-accent
 * marker (pin + chevron + halo + ring), NOT a transparent white pillar.
 *
 * Run: node qa/beacon-shot.mjs http://localhost:5174
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))

await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
  // entry quest (es-cafe) — objective NPC at the plaza, by the spawn.
  localStorage.setItem("wp:activeQuest:v1", "es-cafe-travel")
  localStorage.removeItem("wp:quest:v1")
})

await page.goto(url, { waitUntil: "load" })
// Click through any entry surfaces (welcome + maybe a language chooser) until the
// entry root is gone and the world is up.
for (let i = 0; i < 4; i++) {
  const btn = await page.$(".wp-entry-btn")
  if (!btn) break
  await btn.click().catch(() => {})
  await page.waitForTimeout(700)
}
await page.waitForFunction(() => !document.querySelector(".wp-entry-root"), { timeout: 8000 }).catch(() => {})
const ok = await page.waitForFunction(() => !!(window).__wpQuest, { timeout: 20000 }).then(() => true).catch(() => false)
console.log("game booted:", ok)
if (!ok) { console.log("errors:", errors.slice(0, 6)); await browser.close(); process.exit(1) }

// Let the crowd station the objective NPC + the beacon settle, then nudge the
// player toward the objective so the marked NPC + beacon are framed.
await page.waitForTimeout(2500)
const st = await page.evaluate(() => (window).__wpQuest.state())
console.log("active step:", JSON.stringify(st.step))
await page.evaluate(() => (window).__wpQuest.gotoObjective())
await page.waitForTimeout(1500)

await page.screenshot({ path: "/tmp/wp-beacon.png" })
// a second, tighter wait a beat later to catch the bob/pulse at a different phase.
await page.waitForTimeout(700)
await page.screenshot({ path: "/tmp/wp-beacon-2.png" })

console.log("pageerrors:", errors.length ? errors.slice(0, 4) : "none")
console.log("screenshots: /tmp/wp-beacon.png, /tmp/wp-beacon-2.png")
await browser.close()
