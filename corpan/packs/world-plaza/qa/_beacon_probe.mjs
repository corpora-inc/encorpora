import { webkit } from "playwright"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } })
page.on("pageerror", (e) => console.log("ERR", String(e)))
await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({ name: { playerId: "p", displayName: "Otter", nameSeed: { adjId: "brave", nounId: "otter" } }, avatar: { base: "body-1", layers: [] } }))
  localStorage.setItem("wp:activeQuest:v1", "es-cafe-travel")
  localStorage.removeItem("wp:quest:v1")
})
await page.goto("http://localhost:5174/", { waitUntil: "load" })
for (let i=0;i<4;i++){ const b=await page.$(".wp-entry-btn"); if(!b)break; await b.click().catch(()=>{}); await page.waitForTimeout(700) }
await page.waitForFunction(() => !!window.__wpQuest, { timeout: 20000 })
await page.waitForTimeout(2500)
// Inspect the meshes named wp-obj-* : their material alphaMode + a sample texel
const info = await page.evaluate(() => {
  const s = window.__wpScene && window.__wpScene()
  if (!s) return "no scene"
  return s.meshes.filter(m=>m.name.startsWith("wp-obj-")).map(m=>({
    name: m.name, enabled: m.isEnabled(), alpha: m.material?.alpha,
    alphaMode: m.material?.alphaMode, tMode: m.material?.transparencyMode,
    useAlphaDiff: m.material?.useAlphaFromDiffuseTexture,
    y: m.position.y.toFixed(2)
  }))
})
console.log(JSON.stringify(info, null, 1))
await browser.close()
