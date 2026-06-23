import { webkit } from "playwright"

const base = process.argv[2] ?? "http://localhost:5174"
const browser = await webkit.launch()
const errors = []

async function shot(query, out, ms = 2600) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 760 } })
  page.on("pageerror", (e) => errors.push(`[${out}] ${e}`))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`[${out} console] ${m.text()}`)
  })
  await page.goto(`${base}/qa/preview-dressing.html${query}`, { waitUntil: "load" })
  await page.waitForTimeout(ms)
  const info = await page.evaluate(() => (window).__wpDressing ?? null)
  await page.screenshot({ path: out })
  console.log(out, "→ meshes:", info?.meshes, "thinInstances:", info?.thinInstances)
  await page.close()
}

await shot("", "/tmp/wp-dressing-full.png")
await shot("?lean=1", "/tmp/wp-dressing-lean.png")
await shot("?grand=1", "/tmp/wp-dressing-grand.png", 3200)
await shot("?grand=1&lean=1", "/tmp/wp-dressing-grand-lean.png", 3200)

await browser.close()
if (errors.length) {
  console.log("\n--- page errors ---")
  for (const e of errors) console.log(e)
  process.exit(1)
}
console.log("\nOK — no page errors")
