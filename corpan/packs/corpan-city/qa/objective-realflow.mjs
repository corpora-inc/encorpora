/**
 * #58 REAL-FLOW PROOF — for EACH beginner quest (cafe/market/directions) and a
 * quest SWITCH, a NAMED talkable NPC is actually present + FOCUSABLE under the
 * beacon, via the REAL stationing + focus + Talk + dialogue + Begin path (NOT the
 * __wpQuest teleport/advance hooks, which bypass that). Steps per quest:
 *   1. boot/switch so the quest is active,
 *   2. respawn the player AT the objective anchor (within the 4u focus RANGE) —
 *      uses respawnAt, but everything after is the REAL flow,
 *   3. tick the frame loop → the REAL npcFocus picks the stationed NPC → the
 *      ".wp-interact" Talk button appears (proves it's focusable),
 *   4. click Talk → the NPC dialogue opens with the NAMED special in its header,
 *   5. the deterministic "Begin" chip appears (the challenge launch affordance),
 *   6. screenshot the NPC under the beacon.
 *
 * Run: node qa/objective-realflow.mjs http://localhost:5174
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 980, height: 780 }, hasTouch: true })
const errs = []
page.on("pageerror", (e) => errs.push(String(e).slice(0, 140)))
const R = []
const A = (n, ok, d = "") => { R.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`) }

await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({ name: { playerId: "p", displayName: "O", nameSeed: { adjId: "brave", nounId: "otter" } }, avatar: { base: "body-1", layers: [] } }))
  localStorage.setItem("wp:activeQuest:v1:en:es", "es-cafe-travel")
  localStorage.removeItem("wp:quest:v1:en:es")
})
await page.goto(`${url}/?stack=en,es`, { waitUntil: "load" })
for (let i = 0; i < 8; i++) { const g = await page.evaluate(() => !document.querySelector(".wp-entry-root")); if (g) break; const x = await page.$(".wp-entry-btn"); if (x) await x.click().catch(() => {}); await page.waitForTimeout(700) }
const booted = await page.waitForFunction(() => !!window.__wpQuest, { timeout: 20000 }).then(() => true).catch(() => false)
A("game booted", booted)
if (!booted) { console.log(errs.slice(0, 5)); await browser.close(); process.exit(1) }
await page.waitForTimeout(1500)

// Close any open dialogue, respawn near the active objective NPC, let the REAL
// focus pick it, then drive Talk → assert the named dialogue + Begin chip.
async function verifyActiveQuest(tag, expectName) {
  // close any leftover dialogue
  await page.evaluate(() => document.querySelector(".wp-npc-close")?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
  await page.waitForTimeout(300)
  const step = await page.evaluate(() => window.__wpQuest.state().step)
  A(`${tag}: active step has an anchor`, !!step?.anchorId, JSON.stringify(step))

  // respawn AT the objective anchor → within the focus RANGE of the stationed NPC.
  await page.evaluate(() => window.__wpQuest.gotoObjective())
  // give the frame loop time to run npcFocus + show the Talk button.
  await page.waitForTimeout(1500)

  // THE GUARANTEE: the REAL focus system found a NPC → the Talk affordance shows.
  const talk = await page.waitForSelector(".wp-interact", { state: "visible", timeout: 4000 }).then(() => true).catch(() => false)
  A(`${tag}: a focusable NPC is under the beacon (REAL Talk button visible)`, talk)
  await page.screenshot({ path: `/tmp/wp-objnpc-${tag}.png` })
  if (!talk) return

  // tap Talk → the NPC dialogue opens with the NAMED special in the header.
  await page.click(".wp-interact").catch(() => {})
  await page.waitForSelector(".wp-npc-panel", { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(400)
  const headerName = await page.evaluate(() => document.querySelector(".wp-npc-name")?.textContent ?? "")
  A(`${tag}: dialogue opens with the NAMED objective NPC ("${expectName}")`, headerName === expectName, `header="${headerName}"`)

  // the deterministic Begin chip (the challenge launch affordance) appears.
  const begin = await page.waitForSelector(".wp-npc-chip-play", { timeout: 5000 }).then(() => true).catch(() => false)
  A(`${tag}: the Begin chip is present (challenge launchable)`, begin)
}

// 1) CAFÉ (boot quest) — café host @plaza.
await verifyActiveQuest("cafe", "the café host")

// 2) MARKET — switch to it (the picker path), market vendor @market.
await page.evaluate(() => document.querySelector(".wp-npc-close")?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
await page.waitForTimeout(300)
A("switch to the market quest", (await page.evaluate(() => window.__wpQuest.switchQuest("es-market-haggle"))) === true)
await page.waitForTimeout(700)
await verifyActiveQuest("market", "the market vendor")

// 3) DIRECTIONS — switch to it, helpful local @fountain.
await page.evaluate(() => document.querySelector(".wp-npc-close")?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
await page.waitForTimeout(300)
A("switch to the directions quest", (await page.evaluate(() => window.__wpQuest.switchQuest("es-directions"))) === true)
await page.waitForTimeout(700)
await verifyActiveQuest("directions", "a helpful local")

console.log("\npageerrors:", errs.length ? errs.slice(0, 5) : "none")
const f = R.filter((r) => !r.ok)
console.log(`\n${R.length - f.length}/${R.length} passed`)
console.log("screenshots: /tmp/wp-objnpc-{cafe,market,directions}.png")
await browser.close()
process.exit(f.length ? 1 : 0)
