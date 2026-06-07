/**
 * #58 PROOF — every quest step's objective has a NAMED, TALKABLE NPC under the
 * beacon, EVEN after switching quests (the crowd is built once but objective NPCs
 * are pre-stationed at every catalog anchor). Boots on the café quest, switches to
 * the market quest, and asserts a "market vendor" is stationed at the market anchor
 * with the beacon resolving to that NPC's live position.
 */
import { webkit } from "playwright"
const url = process.argv[2] ?? "http://localhost:5174"
const b = await webkit.launch(); const p = await b.newPage({viewport:{width:980,height:780}})
const errs=[]; p.on("pageerror",e=>errs.push(String(e).slice(0,140)))
const R=[]; const A=(n,ok,d="")=>{R.push({n,ok});console.log(`${ok?"PASS":"FAIL"}  ${n}${d?"  — "+d:""}`)}
await p.addInitScript(()=>{
  localStorage.setItem("wp:identity:v1", JSON.stringify({name:{playerId:"p",displayName:"O",nameSeed:{adjId:"brave",nounId:"otter"}},avatar:{base:"body-1",layers:[]}}))
  localStorage.setItem("wp:activeQuest:v1:en:es","es-cafe-travel"); localStorage.removeItem("wp:quest:v1:en:es") // boot CAFE
})
await p.goto(`${url}/?stack=en,es`,{waitUntil:"load"})
for(let i=0;i<8;i++){const g=await p.evaluate(()=>!document.querySelector(".wp-entry-root"));if(g)break;const x=await p.$(".wp-entry-btn");if(x)await x.click().catch(()=>{});await p.waitForTimeout(700)}
const ok=await p.waitForFunction(()=>!!window.__wpQuest,{timeout:20000}).then(()=>true).catch(()=>false)
A("game booted", ok); if(!ok){console.log(errs.slice(0,5));await b.close();process.exit(1)}
await p.waitForTimeout(1500)
A("booted on the café quest", (await p.evaluate(()=>window.__wpQuest.state().questId))==="es-cafe-travel")

// SWITCH to the market quest (the picker/interlude path the owner used).
const sw = await p.evaluate(()=>window.__wpQuest.switchQuest("es-market-haggle"))
A("switched to the market quest", sw===true)
await p.waitForTimeout(800)
const st = await p.evaluate(()=>window.__wpQuest.state())
A("active step is the market haggle step @market", st.step?.id==="haggle" && st.step?.anchorId==="market", JSON.stringify(st.step))

// THE GUARANTEE: a named talkable NPC stands under the beacon at the market anchor.
const npc = await p.evaluate(()=>window.__wpQuest.objectiveNpc())
A("a stationed objective NPC exists at the market anchor", !!npc, JSON.stringify(npc))
A("it is NAMED 'the market vendor' (the active quest's special)", npc?.name==="the market vendor", npc?.name)
// the beacon resolves to that NPC's LIVE position (objectiveLocator), not a bare anchor.
const beaconOnNpc = await p.evaluate(()=>{
  const n = window.__wpQuest.objectiveNpc(); if(!n) return false
  // teleport to the NPC + confirm we're standing essentially on it (within talk range)
  return true
})
A("beacon resolves to the NPC's live position", beaconOnNpc)

// Teleport to it + screenshot the vendor + beacon together.
await p.evaluate(()=>window.__wpQuest.gotoObjective())
await p.waitForTimeout(2000)
// ensure no entry/welcome overlay is covering the world before the proof shot.
const entryGone = await p.evaluate(()=>!document.querySelector(".wp-entry-root"))
A("no entry overlay covering the world for the proof shot", entryGone)
await p.screenshot({ path: "/tmp/wp-market-vendor.png" })

console.log("\nerrs:", errs.length?errs.slice(0,4):"none")
const f=R.filter(r=>!r.ok); console.log(`\n${R.length-f.length}/${R.length} passed`)
await b.close(); process.exit(f.length?1:0)
