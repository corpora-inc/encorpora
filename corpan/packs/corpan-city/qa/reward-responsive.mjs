/**
 * Reward-reveal RESPONSIVENESS proof (WebKit, mock host).
 *
 * The end-of-challenge reward card (crown badge → grade → title → score/XP/coins
 * → item chip → "Claim reward") must fit on ANY screen:
 *   - grow-to-content where there's room (crown NEVER clipped at the top), and
 *   - on constrained viewports, scale/scroll so BOTH the crown AND the Claim
 *     button stay on-screen and reachable.
 *
 * For a matrix of viewport sizes this script drives a challenge to the reward
 * reveal, then asserts, in pixels:
 *   1. the crown badge top edge is >= the scrim's top safe padding (not clipped),
 *   2. the crown is fully inside the viewport,
 *   3. the Claim button is fully inside the viewport AND actually clickable
 *      (scrolling within the reward panel if needed — but it must be reachable),
 *   4. no DOUBLE scrollbar (the card never scrolls; only the reward panel may),
 *   5. clicking Claim resolves a ChallengeResultPlus.
 * Screenshots each size → /tmp/wp-mini-reward-<label>.png.
 *
 *   node qa/reward-responsive.mjs [http://localhost:5196]
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5196"
const url = `${base}/qa/challenges.html`

const SIZES = [
  { label: "narrow-portrait", width: 300, height: 520 },
  { label: "portrait-360", width: 360, height: 640 },
  { label: "short-landscape", width: 900, height: 360 },
  { label: "small", width: 320, height: 320 },
  { label: "wide-desktop", width: 1200, height: 800 },
]

// A spread of tools so the reward content varies (item chip present/absent etc.)
const TOOLS = ["fast-translate", "true-false", "picture-match", "word-scramble", "category-sort"]

const results = []
const assert = (name, ok, detail = "") => {
  results.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`)
}

const browser = await webkit.launch()

/** Auto-play whatever is mounted until the reward reveal appears. */
async function autoPlay(page) {
  for (let step = 0; step < 60; step++) {
    if (await page.$(".wp-ch-reward")) return true

    const traySel = ".wp-ch-chiptile:not(.wp-ch-chiptile--placed):not(.wp-ch-chiptile--inslot)"
    const remaining = await page.$$(traySel)
    if (remaining.length) {
      const before = remaining.length
      for (const c of remaining) {
        await c.click({ timeout: 800 }).catch(() => {})
        await page.waitForTimeout(60)
        if ((await page.$$(traySel)).length < before) break
      }
      await page.waitForTimeout(120)
      continue
    }

    const mic = await page.$(".wp-ch-mic")
    if (mic) {
      await mic.click({ timeout: 600 }).catch(() => {})
      await page.waitForTimeout(300)
      await mic.click({ timeout: 600 }).catch(() => {})
      await page.waitForTimeout(700)
      continue
    }

    const tile = await page.$(".wp-ch-tile:not(.wp-ch-tile--ghost):not(.wp-ch-tile--correct):not(.wp-ch-tile--wrong)")
    if (tile) {
      await tile.click({ timeout: 600 }).catch(() => {})
      await page.waitForTimeout(820)
      continue
    }
    await page.waitForTimeout(200)
  }
  return Boolean(await page.$(".wp-ch-reward"))
}

for (const size of SIZES) {
  const tool = TOOLS[SIZES.indexOf(size) % TOOLS.length]
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    hasTouch: true,
  })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`) })

  await page.goto(url, { waitUntil: "load" })
  await page.waitForFunction(() => typeof window.wpRunChallenge === "function", { timeout: 5000 })

  await page.evaluate((toolId) => { window.wpLastResult = undefined; window.wpRunChallenge(toolId) }, tool)
  await page.waitForSelector(".wp-ch-card", { timeout: 4000 })
  await page.waitForTimeout(420)

  const reached = await autoPlay(page)
  assert(`${size.label}: reached reward (${tool})`, reached)
  if (!reached) { await page.close(); continue }

  await page.waitForTimeout(550) // reveal settles + rows animate in

  // ---- pixel assertions ----
  const m = await page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight
    const scrim = document.querySelector(".wp-ch-scrim")
    const card = document.querySelector(".wp-ch-card")
    const panel = document.querySelector(".wp-ch-reward")
    const burst = document.querySelector(".wp-ch-reward__burst")
    const btn = document.querySelector(".wp-ch-reward .wp-ch-btn")
    const cs = getComputedStyle(scrim)
    const padTop = parseFloat(cs.paddingTop) || 0
    const padBottom = parseFloat(cs.paddingBottom) || 0
    const r = (e) => { const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right, h: b.height } }
    return {
      vw, vh, padTop, padBottom,
      card: r(card), panel: r(panel), burst: r(burst), btn: r(btn),
      cardScrolls: card.scrollHeight - card.clientHeight > 1,
      panelScrolls: panel.scrollHeight - panel.clientHeight > 1,
    }
  })

  // 1. crown not clipped at the top: its top is at/below the card top (card has
  //    overflow:hidden, so being above the card top means it's sliced).
  const crownTopOk = m.burst.t >= m.card.t - 0.5
  assert(`${size.label}: crown not clipped at top`, crownTopOk,
    `burst.t=${m.burst.t.toFixed(1)} card.t=${m.card.t.toFixed(1)}`)

  // 2. crown fully inside the viewport
  const crownInView = m.burst.t >= -0.5 && m.burst.b <= m.vh + 0.5
  assert(`${size.label}: crown fully in viewport`, crownInView,
    `burst t=${m.burst.t.toFixed(1)} b=${m.burst.b.toFixed(1)} vh=${m.vh}`)

  // 3. the card fits within the viewport safe area (never exceeds the scrim pad)
  const cardFits = m.card.t >= m.padTop - 0.5 && m.card.b <= m.vh - m.padBottom + 0.5
  assert(`${size.label}: card within safe area`, cardFits,
    `card t=${m.card.t.toFixed(1)} b=${m.card.b.toFixed(1)} pad=[${m.padTop},${m.padBottom}] vh=${m.vh}`)

  // 4. the CARD itself must not scroll (only the reward panel may)
  assert(`${size.label}: card does not scroll (no double scrollbar)`, !m.cardScrolls,
    `cardScrolls=${m.cardScrolls} panelScrolls=${m.panelScrolls}`)

  // 5. Claim button reachable: scroll it into view within the panel, then assert
  //    it lands fully inside the viewport and is actually clickable.
  await page.$eval(".wp-ch-reward .wp-ch-btn", (el) => el.scrollIntoView({ block: "center" }))
  await page.waitForTimeout(120)
  const btnBox = await page.$eval(".wp-ch-reward .wp-ch-btn", (el) => {
    const b = el.getBoundingClientRect()
    return { t: b.top, b: b.bottom, h: b.height, vh: window.innerHeight }
  })
  const btnReachable = btnBox.t >= -0.5 && btnBox.b <= btnBox.vh + 0.5 && btnBox.h > 10
  assert(`${size.label}: Claim button reachable`, btnReachable,
    `btn t=${btnBox.t.toFixed(1)} b=${btnBox.b.toFixed(1)} vh=${btnBox.vh}`)

  await page.screenshot({ path: `/tmp/wp-mini-reward-${size.label}.png` })

  // 6. it actually claims
  const claim = await page.$(".wp-ch-reward .wp-ch-btn")
  if (claim) await claim.click({ timeout: 1500 }).catch(() => {})
  await page.waitForFunction(() => window.wpLastResult !== undefined, { timeout: 3000 }).catch(() => {})
  const r = await page.evaluate(() => window.wpLastResult)
  assert(`${size.label}: claim resolves a result`, Boolean(r && typeof r.score === "number"))

  assert(`${size.label}: no page/console errors`, errors.length === 0, errors.slice(0, 2).join(" | "))
  await page.close()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
await browser.close()
process.exit(failed.length ? 1 : 0)
