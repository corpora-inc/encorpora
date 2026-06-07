/**
 * Micro-challenge library verification (WebKit, mock host — no native host).
 *
 * For a spread of DIFFERENT tools it:
 *   1. Measures the stand-in stage box BEFORE opening, one frame AFTER opening
 *      (the old layout-shift danger frame), and after the entrance settles —
 *      asserting the stage never moves a pixel (the §4 overlay contract).
 *   2. Screenshots the live encounter card → /tmp/wp-ch-<id>.png.
 *   3. Auto-plays the challenge to completion, then screenshots the reward
 *      reveal → /tmp/wp-ch-<id>-reward.png.
 *   4. Asserts a ChallengeResultPlus came back with a normalized score and
 *      rewards { xp, coins, items } consistent with the score.
 *   5. Asserts closing the overlay also leaves the stage unmoved.
 *
 *   node qa/challenges.mjs [http://localhost:5174]
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const url = `${base}/qa/challenges.html`

const browser = await webkit.launch()
const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}
const sameBox = (a, b) =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5

const page = await browser.newPage({ viewport: { width: 430, height: 880 }, hasTouch: true })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`)
})

await page.goto(url, { waitUntil: "load" })
await page.waitForFunction(() => typeof window.wpRunChallenge === "function", { timeout: 5000 })
assert("harness ready", true)

const stageBox = () => page.$eval("#stage", (el) => el.getBoundingClientRect().toJSON())

/** Auto-play whatever challenge is mounted until the reward reveal appears. */
async function autoPlay(page) {
  for (let step = 0; step < 60; step++) {
    // Done?
    if (await page.$(".wp-ch-reward")) return true

    // Scramble / build-sentence: click tray chips in the correct order by
    // reading the prompt sub ("means …") is hard; instead brute-force: the
    // chiptile that advances is the next correct one — click each in turn until
    // one sticks (placed). We click all un-placed chiptiles each pass.
    // Scramble / build-sentence: chips must be tapped in the CORRECT order.
    // Click each remaining chip; a correct tap latches (--placed) and advances.
    // We loop the remaining set until one latches, then restart the scan, so
    // out-of-order taps (which just shake) don't stall progress.
    const traySel = ".wp-ch-chiptile:not(.wp-ch-chiptile--placed):not(.wp-ch-chiptile--inslot)"
    const remaining = await page.$$(traySel)
    if (remaining.length) {
      const before = remaining.length
      for (const c of remaining) {
        await c.click({ timeout: 800 }).catch(() => {})
        await page.waitForTimeout(60)
        const now = (await page.$$(traySel)).length
        if (now < before) break // one latched → rescan from the top
      }
      await page.waitForTimeout(120)
      continue
    }

    // Word-search: tap each cell pair across rows to claim words. Simplest
    // robust play: click every cell (forms anchors/spans); found words latch.
    const wsCells = await page.$$(".wp-ch-ws-cell:not(.wp-ch-ws-cell--found)")
    if (wsCells.length) {
      for (const cell of wsCells) {
        await cell.click({ timeout: 600 }).catch(() => {})
      }
      await page.waitForTimeout(150)
      // if nothing got found this is unwinnable by brute force — bail to timeout
      continue
    }

    // Memory pairs: a *remembering* solver. Flip every card once to learn its
    // face, then play known matches. (Faces are paired by translation equality
    // across the target↔native cards — but EN/ES text differs, so we instead
    // learn faces by index and pair by the game's own match logic: flip two,
    // if they latch (--done) keep them, else remember both faces and later
    // pair indices whose faces we have seen to latch together.)
    const memCards = await page.$$(".wp-ch-mem")
    if (memCards.length && !(await page.$(".wp-ch-reward"))) {
      const solved = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
        const cards = () => [...document.querySelectorAll(".wp-ch-mem")]
        const faces = new Map() // idx -> text
        // learn all faces
        for (let i = 0; i < cards().length; i++) {
          const c = cards()[i]
          if (c.classList.contains("wp-ch-mem--done")) continue
          c.click(); await sleep(60)
          faces.set(i, (c.textContent || "").trim())
          // flip back if it stayed up alone
          if (c.classList.contains("wp-ch-mem--up")) { c.click(); await sleep(60) }
        }
        // The game pairs by matching KEY, and a target card speaks/native doesn't,
        // but both cards of a pair share the SAME key → same on-screen text only
        // when target==native. Since EN/ES differ, brute pairing by trying each
        // unmatched card against every other and keeping latched matches:
        for (let guard = 0; guard < 40; guard++) {
          const cs = cards()
          const open = cs
            .map((c, i) => ({ c, i }))
            .filter((o) => !o.c.classList.contains("wp-ch-mem--done"))
          if (!open.length) return true
          let progressed = false
          for (let a = 0; a < open.length; a++) {
            for (let b = a + 1; b < open.length; b++) {
              if (open[a].c.classList.contains("wp-ch-mem--done")) break
              if (open[b].c.classList.contains("wp-ch-mem--done")) continue
              open[a].c.click(); await sleep(50)
              open[b].c.click(); await sleep(80)
              if (
                open[a].c.classList.contains("wp-ch-mem--done") &&
                open[b].c.classList.contains("wp-ch-mem--done")
              ) { progressed = true; break }
              // Mismatch now PARKS open until the player taps to flip back (the
              // game no longer auto-snaps on a timer). Study a beat, then tap a
              // revealed card to clear the parked pair and unlock the board.
              await sleep(220)
              const miss = document.querySelector(".wp-ch-mem--miss")
              if (miss) { miss.click(); await sleep(120) }
            }
            if (progressed) break
          }
          if (document.querySelector(".wp-ch-reward")) return true
        }
        return Boolean(document.querySelector(".wp-ch-reward"))
      })
      if (solved) await page.waitForTimeout(600)
      continue
    }

    // STT mic: click record, then click stop (mock scores immediately).
    const mic = await page.$(".wp-ch-mic")
    if (mic) {
      await mic.click({ timeout: 600 }).catch(() => {})
      await page.waitForTimeout(300)
      await mic.click({ timeout: 600 }).catch(() => {})
      await page.waitForTimeout(700)
      continue
    }

    // Generic tiles (MC, category buckets): click the first available tile.
    const tile = await page.$(".wp-ch-tile:not(.wp-ch-tile--ghost):not(.wp-ch-tile--correct):not(.wp-ch-tile--wrong)")
    if (tile) {
      await tile.click({ timeout: 600 }).catch(() => {})
      await page.waitForTimeout(720)
      continue
    }

    await page.waitForTimeout(200)
  }
  return Boolean(await page.$(".wp-ch-reward"))
}

const TOOLS = [
  "word-scramble",
  "build-sentence",
  "fast-translate",
  "picture-match",
  "memory-pairs",
  "true-false",
  "read-aloud",
  "fill-the-blank",
  "category-sort",
  "conjugation-tap",
]

for (const id of TOOLS) {
  // t0: stage box before opening
  const t0 = await stageBox()
  await page.evaluate((toolId) => {
    window.wpLastResult = undefined
    window.wpRunChallenge(toolId)
  }, id)

  // t1: the very next animation frame — the danger frame in the old flow.
  const t1 = await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => r(document.getElementById("stage").getBoundingClientRect().toJSON()))),
  )
  await page.waitForSelector(".wp-ch-card", { timeout: 4000 })
  await page.waitForTimeout(450) // entrance settle
  const t2 = await stageBox()
  assert(`${id}: no shift on open`, sameBox(t0, t1) && sameBox(t0, t2), `t1.y=${t1.y} t2.y=${t2.y}`)

  await page.screenshot({ path: `/tmp/wp-ch-${id}.png` })

  // Auto-play to the reward reveal.
  const reached = await autoPlay(page)
  assert(`${id}: reached reward reveal`, reached)
  if (reached) {
    await page.waitForTimeout(450)
    await page.screenshot({ path: `/tmp/wp-ch-${id}-reward.png` })

    // Claim → resolves the result.
    const claim = await page.$(".wp-ch-reward .wp-ch-btn")
    if (claim) await claim.click().catch(() => {})
    await page.waitForFunction(() => window.wpLastResult !== undefined, { timeout: 3000 }).catch(() => {})
    const r = await page.evaluate(() => window.wpLastResult)
    const ok =
      r &&
      typeof r.score === "number" &&
      r.score >= 0 &&
      r.score <= 1 &&
      r.rewards &&
      r.rewards.xp >= 0 &&
      r.rewards.coins >= 0 &&
      Array.isArray(r.rewards.items)
    assert(`${id}: result + rewards`, Boolean(ok), r ? `score=${r.score.toFixed(2)} xp=${r.rewards.xp} coins=${r.rewards.coins} items=${r.rewards.items.length}` : "no result")
    // reward consistency: a >=0.6 score should grant an item; xp scales w/ score
    if (r && r.score >= 0.6) assert(`${id}: item granted at score≥0.6`, r.rewards.items.length >= 1)
  }

  // t3/t4: closing leaves the stage unmoved.
  const overlayGone = await page.$(".wp-ch-scrim")
  if (overlayGone) {
    await page.evaluate(() => {
      const x = document.querySelector(".wp-ch-close")
      if (x) x.click()
    })
  }
  await page.waitForTimeout(350)
  const t4 = await stageBox()
  assert(`${id}: no shift on close`, sameBox(t0, t4), `t4.y=${t4.y}`)
  // ensure clean teardown before next tool
  await page.waitForTimeout(120)
}

assert("no page/console errors", errors.length === 0, errors.slice(0, 3).join(" | "))

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
