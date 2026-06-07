import { webkit } from "playwright"
const browser = await webkit.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
await page.goto("http://localhost:5174/qa/inventory.html",{waitUntil:"load"})
await page.waitForTimeout(1200)
const r = await page.evaluate(()=>{
  const b=document.querySelector(".wp-menu-body")
  const before = getComputedStyle(b,"::before")
  return { scrollW:b.scrollWidth, clientW:b.clientWidth, beforeMarginLeft:before.marginLeft, beforeMarginRight:before.marginRight, beforeWidth:before.width }
})
console.log(JSON.stringify(r))
await browser.close()
