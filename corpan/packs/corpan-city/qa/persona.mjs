/**
 * Persona-system verification (mock host, no 2.4 GB model).
 *
 * Asserts, against the live WebKit build:
 *   1. ~40 generated personas show a VARIED, WHOLESOME archetype + demeanor mix
 *      (prints both distributions).
 *   2. Two DISTINCT archetypes open with DIFFERENT in-character greetings.
 *   3. Each springs a contrived challenge → a tool-call from its OWN whitelist,
 *      rendering a Challenge card; raw control JSON is never shown.
 *   4. The compiled system prompt carries the persona, the challenge-pretext
 *      lean, and the quest clue whisper.
 *
 * Screenshots: /tmp/wp-persona-A.png, /tmp/wp-persona-B.png, /tmp/wp-persona-dist.png
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const url = `${base}/qa/persona.html`
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
await page.waitForFunction(() => !!window.__wpPersona, { timeout: 5000 })

// ---- 1. distribution -------------------------------------------------------
const data = await page.evaluate(() => ({
  count: window.__wpPersona.count,
  archetypeIds: window.__wpPersona.archetypeIds,
  distArchetype: window.__wpPersona.distArchetype,
  distDemeanor: window.__wpPersona.distDemeanor,
  pickA: window.__wpPersona.pickA,
  pickB: window.__wpPersona.pickB,
  rows: window.__wpPersona.rows,
}))

console.log(`\n=== ${data.count} personas ===`)
console.log("archetype catalogue (" + data.archetypeIds.length + "):", data.archetypeIds.join(", "))
console.log("\narchetype distribution:")
for (const [k, v] of Object.entries(data.distArchetype).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} ${"█".repeat(v)} ${v}`)
}
console.log("\ndemeanor distribution:")
for (const [k, v] of Object.entries(data.distDemeanor).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(14)} ${"█".repeat(v)} ${v}`)
}

const archCount = Object.keys(data.distArchetype).length
assert("varied archetypes (≥8 distinct in 40)", archCount >= 8, `${archCount} distinct`)
const demCount = Object.keys(data.distDemeanor).length
assert("varied demeanors (≥4 distinct)", demCount >= 4, `${demCount} distinct`)
// wholesome-heavy: sly is a small minority of the crowd
const sly = data.distDemeanor.sly ?? 0
assert("wholesome-heavy (sly ≤ 20%)", sly <= data.count * 0.2, `${sly}/${data.count} sly`)
// smuggler is rare
const smug = data.distArchetype.smuggler ?? 0
assert("smuggler is rare (≤ 10%)", smug <= data.count * 0.1, `${smug}/${data.count}`)
// no twins on the obvious axes: many distinct names
const names = new Set(data.rows.map((r) => r.name))
assert("varied names (≥15 distinct)", names.size >= 15, `${names.size} distinct names`)

// a screenshot showing a sample of the distribution rendered on the stage
await page.evaluate((d) => {
  const el = document.createElement("pre")
  el.style.cssText =
    "position:absolute;left:10px;top:10px;right:10px;font:11px/1.3 monospace;color:#2a2118;background:rgba(255,255,255,.82);padding:10px;border-radius:8px;max-height:60%;overflow:auto;z-index:2"
  const arch = Object.entries(d.distArchetype)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.padEnd(13)} ${"#".repeat(v)} ${v}`)
    .join("\n")
  const dem = Object.entries(d.distDemeanor)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.padEnd(13)} ${"#".repeat(v)} ${v}`)
    .join("\n")
  el.textContent = `${d.count} personas\n\nARCHETYPES\n${arch}\n\nDEMEANORS\n${dem}`
  document.getElementById("wp-stage").appendChild(el)
}, data)
await page.screenshot({ path: "/tmp/wp-persona-dist.png" })
await page.evaluate(() => document.querySelector("#wp-stage pre")?.remove())

// ---- 2. archetype A: distinct greeting + contrived challenge ---------------
async function exercise(label, expectArch) {
  await page.waitForFunction(
    () => {
      const npc = document.querySelector(".wp-npc-msg-npc")
      return npc && !npc.classList.contains("wp-npc-msg-streaming") && (npc.textContent ?? "").length > 5
    },
    { timeout: 6000 },
  )
  const greet = await page.$eval(".wp-npc-msg-npc", (el) => el.textContent ?? "")
  // advance one user line to trigger the challenge turn
  await page.fill(".wp-npc-input", "Sí, claro")
  await page.click(".wp-npc-send")
  await page.waitForFunction(
    () => document.querySelectorAll(".wp-npc-toolcard").length >= 1,
    { timeout: 6000 },
  )
  const transcript = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".wp-npc-msg, .wp-npc-toolcard"))
      .map((el) => el.textContent ?? "")
      .join("\n"),
  )
  assert(`[${label}] raw control JSON never shown`, !transcript.includes("<<tool>") && !transcript.includes('"kind"'))
  const intents = await page.evaluate((a) => window.__wpPersona.intents()[a], expectArch)
  const callTool = (intents ?? []).find((i) => i.kind === "callTool")
  assert(`[${label}] contrived challenge → callTool`, !!callTool, JSON.stringify(callTool ?? null))
  return { greet, callTool }
}

const a = await exercise(data.pickA, data.pickA)
console.log(`\n[A=${data.pickA}] greeting: ${JSON.stringify(a.greet.slice(0, 70))}`)
console.log(`[A=${data.pickA}] challenge tool: ${a.callTool?.tool}`)
await page.screenshot({ path: "/tmp/wp-persona-A.png" })

// ---- switch to archetype B -------------------------------------------------
await page.evaluate(() => window.__wpPersona.openSecond())
const b = await exercise(data.pickB, data.pickB)
console.log(`\n[B=${data.pickB}] greeting: ${JSON.stringify(b.greet.slice(0, 70))}`)
console.log(`[B=${data.pickB}] challenge tool: ${b.callTool?.tool}`)
await page.screenshot({ path: "/tmp/wp-persona-B.png" })

assert("two archetypes are distinct", data.pickA !== data.pickB, `${data.pickA} vs ${data.pickB}`)
assert(
  "the two greetings differ",
  a.greet.trim() !== b.greet.trim(),
  `${a.greet.slice(0, 24)} | ${b.greet.slice(0, 24)}`,
)

// ---- 4. system prompt carries persona + leans ------------------------------
const prompt = await page.evaluate(() => window.__wpPersona.promptA())
assert("prompt names the character", /You are .+/.test(prompt))
assert("prompt has challenge-pretext lean", /PRETEXT|scrambled/i.test(prompt))
assert("prompt has the quest-clue whisper", /QUEST WHISPERS|token/i.test(prompt))
assert("prompt teaches the trade vocab", /talk about|Teach words/i.test(prompt))
console.log("\n--- sample compiled system prompt (A) ---\n" + prompt.slice(0, 900) + "\n---")

console.log("\npageerrors:", errors.length ? errors : "none")
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log("screenshots: /tmp/wp-persona-A.png, /tmp/wp-persona-B.png, /tmp/wp-persona-dist.png")
await browser.close()
process.exit(failed.length || errors.length ? 1 : 0)
