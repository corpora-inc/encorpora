/**
 * figure3d harness — proves the NEW 3D "bubble person" character look has real
 * volume from MULTIPLE camera angles (not a flat billboard).
 *
 * Pattern copied from qa/full.mjs + qa/people.mjs: webkit, seed identity +
 * active quest, goto ?stack=en,es, dismiss the entry overlay, wait for the world.
 * Then orbit the camera to grazing/low angles (where a flat billboard collapses
 * to a thin line but a 3D mesh keeps its silhouette) and capture near shots of
 * the player + a cluster of NPCs.
 *
 * Captures BOTH looks for an A/B: default (3D) and ?look=cutout (legacy flat).
 *
 * Screenshots → /tmp/wp-fig3d-*.png
 */
import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()

const seed = `
  localStorage.setItem("wp:identity:v1", JSON.stringify({
    name: { playerId: "player-local", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } },
    avatar: { base: "body-1", layers: [
      { slot: "face", itemId: "skin-tan", tint: "#e8b887" },
      { slot: "hair", itemId: "hair-short", tint: "#3a2415" },
      { slot: "top", itemId: "top-tunic", tint: "#c0532f" },
      { slot: "bottom", itemId: "bottom-trouser", tint: "#2f3d57" }
    ] }
  }))
  localStorage.setItem("wp:activeQuest:v1:en:es", JSON.stringify({ id: "market-greeting" }))
`

async function run(look, tag) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 820 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text())
  })
  await page.addInitScript(seed)
  if (look) await page.addInitScript((l) => { window.__wpCharacterLook = l }, look)

  await page.goto(`${base}/?stack=en,es`, { waitUntil: "load" })
  await page.waitForTimeout(1200)

  // dismiss the entry overlay if present
  const entry = await page.$(".wp-entry-btn")
  if (entry) {
    await entry.click().catch(() => {})
  }
  // wait for the world/quest to come alive
  await page
    .waitForFunction(() => !!window.__wpQuest, { timeout: 12000 })
    .catch(() => {})
  await page.waitForTimeout(2200)

  // 1) overview — default follow camera
  await page.screenshot({ path: `/tmp/wp-fig3d-${tag}-1-overview.png` })

  // 2) walk forward INTO the crowd to get close to several NPCs
  await page.keyboard.down("w")
  await page.waitForTimeout(1600)
  await page.keyboard.up("w")
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/wp-fig3d-${tag}-2-crowd-near.png` })

  // 3) ORBIT the camera to a low/grazing angle — THE 3D-vs-flat test. Drag right
  // then down so we sweep around AND tilt toward the horizon.
  await page.mouse.move(600, 410)
  await page.mouse.down()
  for (let i = 0; i < 24; i++) await page.mouse.move(600 + i * 14, 410 + i * 4)
  await page.mouse.up()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `/tmp/wp-fig3d-${tag}-3-orbit-grazing.png` })

  // 4) orbit further around to the other side (back of the characters)
  await page.mouse.move(600, 410)
  await page.mouse.down()
  for (let i = 0; i < 24; i++) await page.mouse.move(600 - i * 14, 410 - i * 2)
  await page.mouse.up()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `/tmp/wp-fig3d-${tag}-4-orbit-around.png` })

  // 5) a near PLAYER shot — turn in place then a tiny nudge
  await page.keyboard.down("a")
  await page.waitForTimeout(400)
  await page.keyboard.up("a")
  await page.waitForTimeout(500)
  await page.screenshot({ path: `/tmp/wp-fig3d-${tag}-5-player-near.png` })

  console.log(`[${tag}] quest live:`, await page.evaluate(() => !!window.__wpQuest))
  console.log(`[${tag}] errors:`, errors.length ? errors.slice(0, 5) : "none")
  await page.close()
}

await run(undefined, "3d") // default = bubble3d
await run("cutout", "cutout") // legacy flat reference

await browser.close()
console.log("done — screenshots at /tmp/wp-fig3d-*.png")
