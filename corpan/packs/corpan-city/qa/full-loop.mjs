/**
 * The whole loop, end to end: walk to a townsperson → conversation → the NPC
 * contrives a challenge (tool-call) → the centered challenge encounter launches.
 * Standalone uses the mock LLM (emits a <<tool>> call) + mock corpus.
 */
import { webkit } from "playwright"

const url = process.argv[2] ?? "http://localhost:5180"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 720 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e)))
await page.addInitScript(() => {
  localStorage.setItem(
    "wp:identity:v1",
    JSON.stringify({
      name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
      avatar: { base: "body-1", layers: [] },
    }),
  )
  localStorage.removeItem("wp:economy:v1") // fresh wallet
})
await page.goto(url, { waitUntil: "load" })
await page.waitForTimeout(3200)

// approach a townsperson + engage
await page.keyboard.down("d")
await page.waitForTimeout(2000)
await page.keyboard.up("d")
await page.waitForTimeout(300)
await page.click(".wp-interact").catch(() => {})
await page.waitForTimeout(1200)
const dialogue = await page.$("[class^='wp-npc']").then((e) => !!e)
await page.screenshot({ path: "/tmp/wp-loop-1-talk.png" })

// let the mock LLM stream its reply incl. the tool-call → challenge overlay
await page.waitForTimeout(3500)
const challenge = await page.$("[class*='wp-ch']").then((e) => !!e)
await page.screenshot({ path: "/tmp/wp-loop-2-challenge.png" })

const coinHud = await page.$eval(".wp-coinhud", (el) => el.textContent).catch(() => "(none)")
console.log("dialogue opened:", dialogue)
console.log("challenge overlay present:", challenge)
console.log("coin HUD:", coinHud)
console.log("errors:", errors.length ? errors.slice(0, 4) : "none")
await browser.close()
