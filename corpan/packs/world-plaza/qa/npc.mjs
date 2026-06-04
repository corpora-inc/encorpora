/**
 * NPC dialogue verification (mock host, no 2.4 GB model).
 *
 * Mounts the dialogue panel over a stand-in stage and asserts, against the live
 * WebKit build:
 *   1. The panel opens and the NPC streams an in-character greeting (Spanish).
 *   2. The keyboard composer accepts a user line → another NPC turn streams.
 *   3. A turn carrying a `<<tool>{…}</tool>>` block:
 *        - shows the spoken prose but NOT the raw control JSON, and
 *        - is parsed into a structured NpcIntent (callTool / reward).
 *   4. A fired tool renders a "Challenge" card in the flow.
 *
 * Screenshots: /tmp/wp-npc-stream.png (streamed conversation) and
 * /tmp/wp-npc-tool.png (after a parsed tool-call).
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const url = `${base}/qa/npc.html`
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 430, height: 880 }, hasTouch: true })
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

await page.goto(url, { waitUntil: "load" })

// ---- 1. panel opens + greeting streams ------------------------------------
await page.waitForSelector(".wp-npc-panel.wp-npc-open, .wp-npc-root.wp-npc-open", { timeout: 4000 })
// wait for the first NPC bubble to finish streaming (caret removed)
await page.waitForFunction(
  () => {
    const npc = document.querySelector(".wp-npc-msg-npc")
    return npc && !npc.classList.contains("wp-npc-msg-streaming") && (npc.textContent ?? "").length > 5
  },
  { timeout: 6000 },
)
const greeting = await page.$eval(".wp-npc-msg-npc", (el) => el.textContent ?? "")
assert("NPC greeting streamed", greeting.length > 5, JSON.stringify(greeting.slice(0, 48)))
assert(
  "greeting is in-character Spanish",
  /buenos días|bienvenido|café/i.test(greeting),
  greeting.slice(0, 40),
)

await page.screenshot({ path: "/tmp/wp-npc-stream.png" })

// ---- 2. user line via composer → another NPC turn -------------------------
await page.fill(".wp-npc-input", "Un café, por favor")
await page.click(".wp-npc-send")
await page.waitForFunction(
  () => document.querySelectorAll(".wp-npc-msg-you").length >= 1,
  { timeout: 3000 },
)
assert("user message rendered", true)

// the second NPC turn carries the repeat-after tool block
await page.waitForFunction(
  () => document.querySelectorAll(".wp-npc-toolcard").length >= 1,
  { timeout: 6000 },
)

// ---- 3. tool block: prose shown, raw JSON NOT shown -----------------------
const transcript = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".wp-npc-msg, .wp-npc-toolcard"))
    .map((el) => el.textContent ?? "")
    .join("\n"),
)
assert(
  "raw control JSON is never shown to the user",
  !transcript.includes("<<tool>") && !transcript.includes('"kind"'),
)

const intents = await page.evaluate(() => window.__wpNpc.intents())
const callTool = intents.find((i) => i.kind === "callTool")
assert(
  "tool-call parsed into NpcIntent(callTool repeat-after)",
  !!callTool && callTool.tool === "repeat-after",
  JSON.stringify(callTool ?? null),
)

// ---- 4. tool card rendered in the flow ------------------------------------
const cards = await page.evaluate(() => window.__wpNpc.toolCards())
assert("a Challenge card rendered for the fired tool", cards.length >= 1, JSON.stringify(cards))

await page.screenshot({ path: "/tmp/wp-npc-tool.png" })

// ---- 5. PROOF: challenge intro/segue lives BY THE BUTTON, not the bubble ---
// Reopen as the OBJECTIVE NPC (forcedOffer → deterministic "Begin" chip). The
// challenge intro/segue must render as the Play-row caption (by the button) and
// NEVER as a dialog bubble in the log.
await page.evaluate(() => window.__wpNpc.openObjective())
await page.waitForSelector(".wp-npc-play-caption", { timeout: 6000 })
await page.waitForSelector(".wp-npc-chip-play", { timeout: 6000 })

const segueProof = await page.evaluate(() => {
  const cap = document.querySelector(".wp-npc-play-caption")
  const playrow = document.querySelector(".wp-npc-playrow")
  const log = document.querySelector(".wp-npc-log")
  const caption = (cap?.textContent ?? "").trim()
  return {
    caption,
    captionInPlayrow: !!playrow?.querySelector(".wp-npc-play-caption"),
    buttonInPlayrow: !!playrow?.querySelector(".wp-npc-chip-play"),
    // does the segue text leak into the dialog log? (must be false)
    captionTextInLog: caption.length > 0 && (log?.textContent ?? "").includes(caption),
    captionElInLog: !!document.querySelector(".wp-npc-log .wp-npc-play-caption"),
  }
})
assert("challenge intro caption is present by the button", segueProof.caption.length > 0, JSON.stringify(segueProof.caption.slice(0, 40)))
assert("caption + Begin button live in the play row (button chrome)", segueProof.captionInPlayrow && segueProof.buttonInPlayrow)
assert("challenge intro text does NOT appear in the dialog log", !segueProof.captionTextInLog)
assert("caption element is NOT inside the dialog log", !segueProof.captionElInLog)

await page.screenshot({ path: "/tmp/wp-npc-segue.png" })

console.log("\npageerrors:", errors.length ? errors : "none")
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log("screenshots: /tmp/wp-npc-stream.png, /tmp/wp-npc-tool.png, /tmp/wp-npc-segue.png")
await browser.close()
process.exit(failed.length ? 1 : 0)
