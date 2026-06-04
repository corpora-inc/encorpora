/**
 * End-to-end visual verification in WebKit (≈ macOS WKWebView):
 *  A) fresh load → onboarding renders
 *  B) seeded identity → atmospheric world → walk to an NPC → live (mock) Qwen3 chat
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()

// ---- A) onboarding ----
const a = await browser.newPage({ viewport: { width: 414, height: 820 } })
await a.context().clearCookies()
await a.addInitScript(() => localStorage.clear())
await a.goto(url, { waitUntil: "load" })
await a.waitForTimeout(1800)
await a.screenshot({ path: "/tmp/wp-full-onboarding.png" })
const onbVisible = await a.$(".wp-onb-root, [class^='wp-onb']").then((el) => !!el).catch(() => false)
await a.close()

// ---- B) world + NPC dialogue (skip onboarding via seeded identity) ----
const b = await browser.newPage({ viewport: { width: 1000, height: 700 } })
const errors = []
b.on("pageerror", (e) => errors.push(String(e)))
await b.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "player-local", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
})
await b.goto(url, { waitUntil: "load" })
await b.waitForTimeout(2000)
await b.screenshot({ path: "/tmp/wp-full-world.png" })

// walk toward the tailor NPC (world -x) then engage
await b.keyboard.down("d")
await b.waitForTimeout(2200)
await b.keyboard.up("d")
await b.waitForTimeout(300)
const btn = await b.$(".wp-interact")
const btnVisible = btn ? await btn.evaluate((el) => el.style.display !== "none") : false
await b.screenshot({ path: "/tmp/wp-full-focus.png" })
if (btnVisible) await b.click(".wp-interact").catch(() => {})
await b.waitForTimeout(2600) // let the mock LLM stream
await b.screenshot({ path: "/tmp/wp-full-dialogue.png" })
const dialogue = await b
  .$eval("[class^='wp-npc']", () => true)
  .catch(() => false)

console.log("A) onboarding visible:", onbVisible)
console.log("B) Talk button visible:", btnVisible)
console.log("B) dialogue panel present:", dialogue)
console.log("errors:", errors.length ? errors : "none")
await browser.close()
