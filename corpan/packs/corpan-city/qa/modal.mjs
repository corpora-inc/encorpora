/**
 * Verifies the dialogue is truly MODAL: while it's open, WASDQE/space/E and
 * the joystick are inert (player doesn't move) and no second conversation
 * stacks. Uses the dev-only window.__wpPlayer.pos() hook.
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })
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
})
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(1600)

// approach an NPC and open the dialogue
await page.keyboard.down("d")
await page.waitForTimeout(2200)
await page.keyboard.up("d")
await page.waitForTimeout(300)
await page.click(".wp-interact").catch(() => {})
await page.waitForTimeout(800)

const posBefore = await page.evaluate(() => window.__wpPlayer?.pos?.() ?? null)

// hammer the world inputs that used to bleed through
await page.keyboard.down("w")
await page.waitForTimeout(900)
await page.keyboard.up("w")
for (let i = 0; i < 3; i++) {
  await page.keyboard.press("Space")
  await page.keyboard.press("e")
}
await page.waitForTimeout(400)

const posAfter = await page.evaluate(() => window.__wpPlayer?.pos?.() ?? null)
const dialogues = await page.$$eval(".wp-npc-scrim", (els) => els.length).catch(() => -1)

const moved =
  posBefore && posAfter ? Math.hypot(posAfter.x - posBefore.x, posAfter.z - posBefore.z) : -1

console.log("pos before:", posBefore, "after:", posAfter)
console.log("moved while modal open (want ~0):", moved.toFixed(3))
console.log("dialogue panels open (want 1):", dialogues)
console.log("errors:", errors.length ? errors : "none")
await browser.close()
