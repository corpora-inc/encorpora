import { webkit } from "playwright"

const PORT = process.env.WP_PORT || "5174"
const URL = `http://localhost:${PORT}/result-harness.html`
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 430, height: 760 } })
const errors = []
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text())
})
page.on("pageerror", (e) => errors.push(String(e)))

await page.goto(URL, { waitUntil: "networkidle" })
await page.waitForSelector(".wp-ch-reward--in", { timeout: 6000 })

const tiers = [
  { score: 0, name: "fail-0" },
  { score: 0.4, name: "low-40" },
  { score: 0.6, name: "mid-60" },
  { score: 1, name: "perfect-100" },
]
for (const t of tiers) {
  await page.evaluate((s) => window.__wpResult(s, true), t.score)
  await page.waitForSelector(".wp-ch-reward--in", { timeout: 6000 })
  await page.waitForTimeout(900) // let the staggered rows + crest settle
  const out = `/tmp/wp-result-${t.name}.png`
  await page.screenshot({ path: out })
  console.log(`[shot] ${t.name} → ${out}`)
}

if (errors.length) console.error("[shot] CONSOLE ERRORS:\n" + errors.join("\n"))
await browser.close()
console.log(errors.length ? "DONE-WITH-ERRORS" : "DONE-CLEAN")
