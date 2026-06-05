/**
 * #26 PROOF — the quest is actually playable end-to-end in the REAL game.
 *
 * Drives the full Babylon game (not a unit test): seeds identity + forces the
 * active quest, then uses the standalone `window.__wpQuest` dev hook to walk each
 * step to completion the way a player would — teleport to the objective anchor
 * (so a TRAVERSE step's proximity trigger fires) / win the talk challenge — and
 * asserts the engine ADVANCES and the quest COMPLETES. Screenshots at each beat.
 *
 * Run: node qa/quest-loop.mjs http://localhost:5174
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`)
})

const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

// Seed a saved identity (skip onboarding) + force the across-city quest active.
await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
  // #42: active quest + progress are keyed per-pair (dev defaults to en:es).
  localStorage.setItem("wp:activeQuest:v1:en:es", "es-guadalajara-route")
  localStorage.removeItem("wp:quest:v1:en:es") // fresh quest progress for this pair
})

// ?stack=en,es → the en:es pair (es-guadalajara's learnerPair); dev default is es:es.
await page.goto(`${url}/?stack=en,es`, { waitUntil: "load" })

// The welcome/entry card gates the world build — click "Step into the morning
// light" to enter, then wait for the world + the dev quest hook to come up.
await page.waitForSelector(".wp-entry-btn", { timeout: 10000 }).catch(() => {})
await page.click(".wp-entry-btn").catch(() => {})
const haveHook = await page
  .waitForFunction(() => !!(window).__wpQuest, { timeout: 20000 })
  .then(() => true)
  .catch(() => false)
assert("game booted + __wpQuest hook present", haveHook)
if (!haveHook) {
  console.log("errors:", errors.slice(0, 6))
  await page.screenshot({ path: "/tmp/wp-quest-0-boot.png" })
  await browser.close()
  process.exit(1)
}

const qstate = () => page.evaluate(() => (window).__wpQuest.state())

// ── Step 1: "Ask for the ferry at the harbor" — a TALK challenge. ───────────
let s = await qstate()
assert("active quest is es-guadalajara-route", s.questId === "es-guadalajara-route", s.questId)
assert("step 1 is the docks talk step at the harbor", s.step?.id === "docks" && s.step?.anchorId === "harbor", JSON.stringify(s.step))
assert("step 1 is gated (needs-challenge, not auto-done)", s.stepState === "needs-challenge", s.stepState)
await page.screenshot({ path: "/tmp/wp-quest-1-docks.png" })

// Win the talk challenge (emulates beating the Begin micro-game) → advance.
const won = await page.evaluate(() => (window).__wpQuest.winCurrent())
assert("winning the docks challenge advances the step", won === true)

s = await qstate()
assert("step 2 is the bridge TRAVERSE step", s.step?.id === "gate" && s.step?.kind === "traverse", JSON.stringify(s.step))
assert("step 2 anchor is the river bridge", s.step?.anchorId === "bridge_n", s.step?.anchorId)

// ── Step 2: "Cross the river bridge" — a TRAVERSE step (#55 conversation-driven).
// Walk to the bridge (teleport), then TALK to the keeper to finish — the silent
// proximity auto-advance was removed (#55: it felt hollow). `winCurrent()`
// emulates the keeper's "Done" confirm (markStepBeaten + advance).
const gotoOk = await page.evaluate(() => (window).__wpQuest.gotoObjective())
assert("teleported to the bridge objective", gotoOk === true)
await page.waitForTimeout(600)
// Arriving does NOT auto-complete now — you must talk to the keeper.
const stillActive = await page.evaluate(() => (window).__wpQuest.state().step?.id === "gate")
assert("arriving does NOT auto-complete — must talk to the keeper (#55)", stillActive === true)
await page.screenshot({ path: "/tmp/wp-quest-2-bridge.png" })

// Talk-to-the-keeper confirm completes the crossing.
const confirmed = await page.evaluate(() => (window).__wpQuest.winCurrent())
assert("talking to the keeper completes the crossing", confirmed === true)

// ── Assert the quest COMPLETED. ─────────────────────────────────────────────
const final = await page.waitForFunction(
  () => (window).__wpQuest.state().complete === true,
  { timeout: 4000 },
).then(() => true).catch(() => false)
assert("the across-city quest COMPLETES (NPC-driven, no dead-end)", final)
s = await qstate()
assert("engine reports complete + no active step", s.complete === true && s.step === null, JSON.stringify({ complete: s.complete, step: s.step }))
await page.screenshot({ path: "/tmp/wp-quest-3-complete.png" })

console.log("\npageerrors:", errors.length ? errors.slice(0, 6) : "none")
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log("screenshots: /tmp/wp-quest-{1-docks,2-bridge,3-complete}.png")
await browser.close()
process.exit(failed.length ? 1 : 0)
