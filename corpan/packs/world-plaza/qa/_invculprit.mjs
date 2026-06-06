import { webkit } from "playwright"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto("http://localhost:5174/qa/inventory.html",{waitUntil:"load"})
await page.waitForTimeout(1500)
const out = await page.evaluate(()=>{
  const body = document.querySelector(".wp-menu-body")
  const bw = body.clientWidth, br = body.getBoundingClientRect()
  const res=[]
  for (const el of body.querySelectorAll("*")){
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    // child wider than body content box, OR extends past body's right edge
    if (r.width - bw > 0.5 || r.right - br.right > 0.5 || r.left < br.left - 0.5){
      res.push({cls:String(el.className).slice(0,40), w:+r.width.toFixed(1), bodyW:bw, right:+r.right.toFixed(1), bodyRight:+br.right.toFixed(1), boxSizing:cs.boxSizing, border:cs.borderRightWidth})
    }
  }
  return { bw, res: res.slice(0,8) }
})
console.log(JSON.stringify(out,null,1))
await browser.close()
