import { webkit } from "playwright"
const browser = await webkit.launch()
async function audit(w,h,label){
  const page = await browser.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 })
  await page.addInitScript(()=>localStorage.clear())
  await page.goto("http://localhost:5174/?stack=es,en",{waitUntil:"load"})
  await page.waitForTimeout(2200)
  for (let i=0;i<12;i++){
    const ok = await page.evaluate(()=>{
      const e=document.querySelector(".wp-onb-btn--enter"); if(e){e.click();return 1}
      const p=[...document.querySelectorAll(".wp-onb-btn--primary")].pop(); if(p){p.click();return 1}
      const en=document.querySelector(".wp-entry-btn"); if(en){en.click();return 1}
      return 0
    })
    if(!ok) break
    await page.waitForTimeout(1000)
  }
  await page.waitForTimeout(2500)
  // any FIXED/absolute sheet whose visible top is inside the viewport bottom band (peeking)
  const peeks = await page.evaluate(()=>{
    const vh=window.innerHeight, out=[]
    for (const el of document.querySelectorAll("body *")){
      const cs=getComputedStyle(el)
      if (cs.position!=="fixed" && cs.position!=="absolute") continue
      const r=el.getBoundingClientRect()
      if (r.width<150 || r.height<10) continue
      const radius=parseFloat(cs.borderTopLeftRadius)||0
      // a wide rounded element whose TOP is visible near the bottom but extends below
      if (r.top>vh-90 && r.top<vh-1 && r.bottom>vh-1 && radius>=10){
        out.push({cls:String(el.className).slice(0,46), top:Math.round(r.top), bottom:Math.round(r.bottom), vh, radius, opacity:cs.opacity, transform:cs.transform.slice(0,30)})
      }
    }
    return out
  })
  console.log(`[${label} ${w}x${h}] peeks=${peeks.length}`, JSON.stringify(peeks))
  await page.screenshot({ path:`/tmp/wp-audit-${label}.png`, clip:{x:0,y:Math.max(0,h-150),width:w,height:150} })
  await page.close()
}
await audit(852,393,"landscape")  // landscape phone (short height)
await audit(402,874,"portrait")
await audit(1024,1366,"tablet")
await browser.close()
