import { webkit } from "playwright"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.addInitScript(() => { localStorage.setItem("wp:identity:v1", JSON.stringify({ name: { playerId: "p", displayName: "Brave Otter", nameSeed: { adjId: "brave", nounId: "otter" } }, avatar: { base: "body-1", layers: [] } })) })
await page.goto("http://localhost:5174", { waitUntil: "load" })
await page.waitForTimeout(2500)
await page.click(".wp-entry-lang", { timeout: 1500 }).catch(() => {})
await page.click(".wp-entry-btn", { timeout: 4000 }).catch(() => {})
await page.waitForFunction(() => typeof window.__wpScene === "function", { timeout: 15000 }).catch(() => {})
await page.keyboard.down("w"); await page.waitForTimeout(1800); await page.keyboard.up("w")
await page.waitForTimeout(3000)
const r = await page.evaluate(() => {
  const sc = window.__wpScene && window.__wpScene()
  const scene = (sc && sc.scene) || sc
  const out = { merged: {}, perBuilding: {} }
  for (const m of scene.meshes) {
    if (!m.isEnabled()) continue
    const n = String(m.name)
    if (n.includes("-merged-")) {
      const cls = n.split("-merged-")[0]
      out.merged[cls] = (out.merged[cls] || 0) + 1
    }
    // are any individual roof/step/shadow caps still around (un-merged)?
    if (/^wp-(r|st|sh)-[0-9]/.test(n)) { const c = n.match(/^wp-(r|st|sh)/)[0]; out.perBuilding[c] = (out.perBuilding[c]||0)+1 }
  }
  return out
})
console.log(JSON.stringify(r, null, 2))
await browser.close()
