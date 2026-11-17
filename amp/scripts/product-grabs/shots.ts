// Ad hoc: run a list of steps against a page and screenshot after each.
// Steps: "goto:URL" "click:TEXT" "role:button:NAME" "wait:MS" "shot:NAME" "scroll:PX"
import { chromium } from "playwright";
import { chromePath } from "../../browser-security.mjs";
const [out, w, h, scheme, ...steps] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: chromePath() });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, colorScheme: scheme as any });
const page = await ctx.newPage();
page.on("console", (m) => m.type() === "error" && console.log("console.error:", m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 200)));
for (const s of steps) {
  const [k, ...rest] = s.split(":");
  const v = rest.join(":");
  const t0 = Date.now();
  if (k === "goto") await page.goto(v, { waitUntil: "networkidle" });
  else if (k === "click") await page.getByText(v, { exact: false }).filter({ visible: true }).first().click();
  else if (k === "aria") console.log((await page.locator(v || "body").ariaSnapshot()).slice(0, 6000));
  else if (k === "css") await page.locator(v).filter({ visible: true }).first().click();
  else if (k === "role") { const [r, ...n] = v.split(":"); await page.getByRole(r as any, { name: n.join(":") }).filter({ visible: true }).first().click(); }
  else if (k === "type") await page.keyboard.type(v, { delay: 70 });
  else if (k === "press") await page.keyboard.press(v);
  else if (k === "fill") { const [sel, ...val] = v.split("="); await page.locator(sel).first().fill(val.join("=")); }
  else if (k === "wait") await page.waitForTimeout(+v);
  else if (k === "scroll") await page.mouse.wheel(0, +v);
  else if (k === "shot") await page.screenshot({ path: `${out}/${v}.png` });
  else if (k === "full") await page.screenshot({ path: `${out}/${v}.png`, fullPage: true });
  console.log(s, Date.now() - t0, "ms", page.url());
}
await browser.close();
