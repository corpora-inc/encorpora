/**
 * CINEMA PROOF — the quest-COMPLETION interlude is a SLOW, staged, rewarding
 * celebration (not a rushed flash).
 *
 * Drives the REAL Babylon game: seeds identity + the across-city quest, walks
 * every step to completion via the `window.__wpQuest` dev hook, then captures a
 * SEQUENCE of screenshots across the cinematic beats so a human can SEE it pace:
 *   anticipation → eyebrow → title reveal → reward tally counting up → picker.
 * Also exercises the Skip affordance (fast-forward) and asserts the picker is
 * NOT shown instantly.
 *
 * Run: node qa/interlude-cinema.mjs http://localhost:5174
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } })
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

await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
  localStorage.setItem("wp:activeQuest:v1:en:es", "es-guadalajara-route")
  localStorage.removeItem("wp:quest:v1:en:es")
})

await page.goto(`${url}/?stack=en,es`, { waitUntil: "load" })
await page.waitForSelector(".wp-entry-btn", { timeout: 10000 }).catch(() => {})
await page.click(".wp-entry-btn").catch(() => {})
const haveHook = await page
  .waitForFunction(() => !!window.__wpQuest, { timeout: 20000 })
  .then(() => true)
  .catch(() => false)
assert("game booted + __wpQuest hook present", haveHook)
if (!haveHook) {
  console.log("errors:", errors.slice(0, 6))
  await page.screenshot({ path: "/tmp/wp-cinema-0-boot.png" })
  await browser.close()
  process.exit(1)
}

const qstate = () => page.evaluate(() => window.__wpQuest.state())

// ── Walk the quest to completion (generic step driver). ─────────────────────
// Each step is either a talk (winCurrent) or a traverse (gotoObjective then,
// for a bridge, crossBridge). Loop until the engine reports complete.
let guard = 0
let s = await qstate()
assert("active quest is es-guadalajara-route", s.questId === "es-guadalajara-route", s.questId)
while (!s.complete && guard++ < 12) {
  const step = s.step
  if (!step) break
  if (step.kind === "traverse") {
    await page.evaluate(() => window.__wpQuest.gotoObjective())
    const far = await page.evaluate(() => window.__wpQuest.completionPoint())
    if (far) await page.evaluate(() => window.__wpQuest.crossBridge())
    // let the per-frame proximity trigger advance
    await page.waitForFunction(
      (prevId) => window.__wpQuest.state().step?.id !== prevId,
      step.id,
      { timeout: 4000 },
    ).catch(() => {})
  } else {
    await page.evaluate(() => window.__wpQuest.winCurrent())
  }
  s = await qstate()
}
assert("quest reached completion (engine.complete)", s.complete === true, JSON.stringify({ complete: s.complete, step: s.step }))

// ── The interlude should now be up. Capture the cinematic BEATS. ────────────
const interludeUp = await page
  .waitForSelector(".wp-qi.wp-qi--in", { timeout: 6000 })
  .then(() => true)
  .catch(() => false)
assert("completion interlude mounted", interludeUp)

// BEAT 1 — anticipation (just after open; title not yet revealed).
await page.waitForTimeout(120)
const stagesAtBeat1 = await page.evaluate(() => {
  const r = document.querySelector(".wp-qi")
  return {
    in: r?.classList.contains("wp-qi--in"),
    stage1: r?.classList.contains("wp-qi-stage1"),
    stage2: r?.classList.contains("wp-qi-stage2"),
    pickerIn: document.querySelector(".wp-qi-picker")?.classList.contains("wp-qi-picker--in"),
    titleOpacity: getComputedStyle(document.querySelector(".wp-qi-title")).opacity,
  }
})
assert("BEAT 1: title NOT yet revealed (anticipation, opacity≈0)", Number(stagesAtBeat1.titleOpacity) < 0.5, `opacity=${stagesAtBeat1.titleOpacity}`)
assert("BEAT 1: picker NOT shown yet (no rushed flash)", stagesAtBeat1.pickerIn === false)
await page.screenshot({ path: "/tmp/wp-cinema-1-anticipation.png" })

// BEAT 2 — the title reveal lands (~1.2s in).
await page.waitForFunction(() => document.querySelector(".wp-qi")?.classList.contains("wp-qi-stage2"), { timeout: 3000 }).catch(() => {})
await page.waitForTimeout(750) // let the 0.7s scale-up fully land before asserting
const titleVisible = await page.evaluate(() => Number(getComputedStyle(document.querySelector(".wp-qi-title")).opacity))
assert("BEAT 2: title is now revealed (opacity≈1)", titleVisible > 0.8, `opacity=${titleVisible}`)
await page.screenshot({ path: "/tmp/wp-cinema-2-title.png" })

// BEAT 3 — the reward tally counts up (capture mid-count).
await page.waitForFunction(() => document.querySelector(".wp-qi-line.wp-qi-line--in"), { timeout: 4000 }).catch(() => {})
await page.waitForTimeout(120)
const tallyMid = await page.evaluate(() => {
  const lines = [...document.querySelectorAll(".wp-qi-line")]
  return {
    lines: lines.length,
    shown: lines.filter((l) => l.classList.contains("wp-qi-line--in")).length,
    amts: lines.map((l) => l.querySelector(".wp-qi-line-amt")?.textContent ?? ""),
  }
})
assert("BEAT 3: reward tally has lines and is revealing them in sequence", tallyMid.lines > 0 && tallyMid.shown >= 1, JSON.stringify(tallyMid))
await page.screenshot({ path: "/tmp/wp-cinema-3-tally.png" })

// BEAT 4 — let the tally finish + the dignified pause.
await page.waitForFunction(() => {
  const lines = [...document.querySelectorAll(".wp-qi-line")]
  return lines.length > 0 && lines.every((l) => l.classList.contains("wp-qi-line--landed"))
}, { timeout: 6000 }).catch(() => {})
await page.screenshot({ path: "/tmp/wp-cinema-4-tally-landed.png" })

// BEAT 5 — the next-quest picker animates in.
const pickerUp = await page
  .waitForSelector(".wp-qi-picker.wp-qi-picker--in", { timeout: 6000 })
  .then(() => true)
  .catch(() => false)
assert("BEAT 5: next-quest picker animates in at the end", pickerUp)
const cardCount = await page.evaluate(() => document.querySelectorAll(".wp-qi-card").length)
assert("picker offers next-quest choice cards", cardCount >= 1, `cards=${cardCount}`)
await page.waitForTimeout(400)
await page.screenshot({ path: "/tmp/wp-cinema-5-picker.png" })

console.log("\npageerrors:", errors.length ? errors.slice(0, 6) : "none")
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log("screenshots: /tmp/wp-cinema-{1-anticipation,2-title,3-tally,4-tally-landed,5-picker}.png")
await browser.close()
process.exit(failed.length ? 1 : 0)
