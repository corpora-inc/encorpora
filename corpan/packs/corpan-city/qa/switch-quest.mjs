import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 820 } })
const errs=[]; page.on("pageerror", e=>errs.push(String(e).slice(0,140)))
const results=[]; const assert=(n,ok,d="")=>{results.push({n,ok});console.log(`${ok?"PASS":"FAIL"}  ${n}${d?"  — "+d:""}`)}
await page.addInitScript(() => {
  localStorage.setItem("wp:identity:v1", JSON.stringify({ name: { playerId: "p", displayName: "Otter", nameSeed: { adjId: "brave", nounId: "otter" } }, avatar: { base: "body-1", layers: [] } }))
  // simulate the STUCK owner: active quest = the across-city one (#42 per-pair key).
  // The seed key MUST match the pair we BOOT with (?stack=en,es → trackId en:es);
  // the dev default with no ?stack is es:es, so seeding en:es while booting es:es
  // would silently miss the key (the seed is read under the boot pair's key).
  localStorage.setItem("wp:activeQuest:v1:en:es", "es-guadalajara-route"); localStorage.removeItem("wp:quest:v1:en:es")
})
// ?stack=en,es → boot the en:es pair so the seeded wp:activeQuest:v1:en:es key is honored.
await page.goto(`${url}/?stack=en,es`, { waitUntil: "load" })
for (let i=0;i<8;i++){ const gone=await page.evaluate(()=>!document.querySelector(".wp-entry-root")); if(gone)break; const b=await page.$(".wp-entry-btn"); if(b)await b.click().catch(()=>{}); await page.waitForTimeout(600) }
await page.waitForFunction(()=>!!window.__wpQuest,{timeout:20000}); await page.waitForTimeout(1500)
let st = await page.evaluate(()=>window.__wpQuest.state())
assert("starts STUCK on es-guadalajara", st.questId==="es-guadalajara-route", st.questId)

// open the menu (pack button), then the Quest section
await page.click(".wp-menu-button").catch(()=>{})
await page.waitForTimeout(500)
// click a nav entry that opens quest — try data attributes / text
const opened = await page.evaluate(() => {
  const nav = Array.from(document.querySelectorAll("button, [role=tab], a")).find(e => /quest|journey|objetivo|misi/i.test(e.textContent||""))
  if (nav) { nav.click(); return true }
  return false
})
await page.waitForTimeout(600)
const hasPicker = await page.evaluate(()=>!!document.querySelector(".wp-quest-switch"))
assert("quest section shows the switch-quest picker", hasPicker, "navOpened="+opened)
await page.screenshot({ path: "/tmp/wp-switch-1.png" })

// click the es-cafe card
const switched = await page.evaluate(() => {
  const card = Array.from(document.querySelectorAll("button.wp-quest-switch-card")).find(b => /coffee|plaza|caf/i.test(b.textContent||""))
  if (card) { card.click(); return true }
  return false
})
await page.waitForTimeout(800)
st = await page.evaluate(()=>window.__wpQuest.state())
assert("switching re-points active quest to es-cafe", st.questId==="es-cafe-travel", st.questId+" (clicked="+switched+")")
await page.screenshot({ path: "/tmp/wp-switch-2.png" })
console.log("errs:", errs.length?errs.slice(0,4):"none")
const failed=results.filter(r=>!r.ok)
console.log(`\n${results.length-failed.length}/${results.length} passed`)
await browser.close()
process.exit(failed.length?1:0)
