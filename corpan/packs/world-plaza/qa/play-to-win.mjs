/**
 * CORE-LOOP PROOF — a player COMPLETES a quest with their THUMB, no mic, via the
 * REAL UI: walk to the objective NPC → Talk → click the deterministic "Begin"
 * chip → the REAL challenge overlay launches → tap the correct tiles → claim the
 * reward → the step advances → the quest COMPLETES.
 *
 * Why this harness exists (the gap that fooled every prior "it's fixed"):
 *   • quest-loop.mjs proves the ENGINE advances, but via the __wpQuest.winCurrent
 *     hook — which BYPASSES the challenge UI entirely.
 *   • objective-realflow.mjs proves the REAL Talk→Begin chip appears, but STOPS at
 *     the chip — it never launches or wins the challenge.
 *   • The standalone mock host reported sttAvailable=true with a generous 0.86
 *     auto-score, so a repeat-after gate "passed" in QA while DYING on a real
 *     device with no working target-language STT. That mismatch is exactly why the
 *     owner could never finish a quest the harnesses all claimed was winnable.
 *
 * This harness refuses the bypass hook: every completing action is a real DOM tap.
 * It uses __wpQuest only to READ state + respawn AT the anchor (focus range). Each
 * quest runs in a FRESH page (a brand-new player meeting that quest), so there is
 * no cross-quest UI bleed.
 *
 * Run: node qa/play-to-win.mjs http://localhost:5174
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const R = []
const A = (n, ok, d = "") => {
  R.push({ n, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`)
}

async function playQuestToWin(tag, questId, expectComplete) {
  const page = await browser.newPage({ viewport: { width: 980, height: 780 }, hasTouch: true })
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)))
  await page.addInitScript((qid) => {
    localStorage.setItem(
      "wp:identity:v1",
      JSON.stringify({
        name: { playerId: "p", displayName: "O", nameSeed: { adjId: "brave", nounId: "otter" } },
        avatar: { base: "body-1", layers: [] },
      }),
    )
    localStorage.setItem("wp:activeQuest:v1:en:es", qid)
    localStorage.removeItem("wp:quest:v1:en:es")
    // QA seam: mark correct MC tiles so we can really tap them. Off in production.
    window.__wpChallengeAuto = true
  }, questId)
  await page.goto(`${url}/?stack=en,es`, { waitUntil: "load" })
  for (let i = 0; i < 8; i++) {
    const gone = await page.evaluate(() => !document.querySelector(".wp-entry-root"))
    if (gone) break
    const x = await page.$(".wp-entry-btn")
    if (x) await x.click().catch(() => {})
    await page.waitForTimeout(700)
  }
  const booted = await page
    .waitForFunction(() => !!window.__wpQuest, { timeout: 20000 })
    .then(() => true)
    .catch(() => false)
  A(`${tag}: game booted on quest ${questId}`, booted)
  if (!booted) {
    console.log(errs.slice(0, 5))
    await page.close()
    return
  }
  await page.waitForTimeout(1500)

  const step0 = await page.evaluate(() => window.__wpQuest.state())
  A(`${tag}: a quest step is active + incomplete`, !!step0.step && !step0.complete, JSON.stringify(step0.step))

  // Respawn AT the objective anchor (focus range), let the REAL focus pick the NPC.
  await page.evaluate(() => window.__wpQuest.gotoObjective())
  await page.waitForTimeout(1400)

  const talk = await page
    .waitForSelector(".wp-interact", { state: "visible", timeout: 4000 })
    .then(() => true)
    .catch(() => false)
  A(`${tag}: Talk button visible under the beacon`, talk)
  if (!talk) {
    await page.close()
    return
  }
  await page.click(".wp-interact").catch(() => {})
  await page.waitForSelector(".wp-npc-panel", { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(500)

  const beginChip = await page.waitForSelector(".wp-npc-chip-play", { timeout: 5000 }).catch(() => null)
  A(`${tag}: Begin chip present`, !!beginChip)
  if (!beginChip) {
    await page.close()
    return
  }
  await beginChip.click().catch(() => {})

  const overlay = await page
    .waitForSelector(".wp-ch-tile, .wp-ch-mic, .wp-ch-chiptile", { timeout: 6000 })
    .catch(() => null)
  A(`${tag}: a challenge overlay launched from Begin`, !!overlay)
  const isMic = await page.$(".wp-ch-mic").then((e) => !!e)
  A(`${tag}: the gate is MIC-FREE (no speak/STT dependency)`, !isMic && !!overlay)

  // Play the rounds: tap the correct tile each round until the reward shows.
  for (let round = 0; round < 12; round++) {
    if (await page.$(".wp-ch-reward")) break
    const correct = await page.$('.wp-ch-tile[data-correct="1"]')
    if (!correct) {
      await page.waitForTimeout(300)
      continue
    }
    await correct.click().catch(() => {})
    await page.waitForTimeout(820)
  }
  // The reward card requires a "Claim reward" tap before the run resolves → that
  // resolution is what fires game.ts's advance. A player MUST claim; so must we.
  const reward = await page.waitForSelector(".wp-ch-reward", { timeout: 4000 }).then(() => true).catch(() => false)
  A(`${tag}: the challenge reached its reward card (won by tapping)`, reward)
  const claim = await page.$(".wp-ch-reward button.wp-ch-reward__row, .wp-ch-reward button")
  if (claim) await claim.click().catch(() => {})
  await page.waitForTimeout(1400) // advance + any completion interlude

  const after = await page.evaluate(() => window.__wpQuest.state())
  const advanced = after.complete || (after.step && JSON.stringify(after.step) !== JSON.stringify(step0.step))
  A(`${tag}: winning the gate ADVANCED the quest (real taps, no mic, no bypass)`, !!advanced, JSON.stringify(after))
  if (expectComplete) {
    A(`${tag}: the quest is fully COMPLETE after one tapped challenge`, after.complete === true, JSON.stringify(after))
  }
  await page.screenshot({ path: `/tmp/wp-playwin-${tag}.png` })
  if (errs.length) console.log(`  ${tag} pageerrors:`, errs.slice(0, 4))
  await page.close()
}

// Three beginner quests — each a 1-challenge gate → COMPLETES by tapping.
await playQuestToWin("cafe", "es-cafe-travel", true)
await playQuestToWin("market", "es-market-haggle", true)
await playQuestToWin("directions", "es-directions", true)

const f = R.filter((r) => !r.ok)
console.log(`\n${R.length - f.length}/${R.length} passed`)
console.log("screenshots: /tmp/wp-playwin-{cafe,market,directions}.png")
await browser.close()
process.exit(f.length ? 1 : 0)
