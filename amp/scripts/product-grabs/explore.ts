// Ad hoc signed-out exploration: screenshot a URL and list its controls.
import { chromium } from "playwright";
import { chromePath } from "../../browser-security.mjs";
const [url, out, w = "390", h = "844", scheme = "light"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: chromePath() });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, colorScheme: scheme as any });
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(url, { waitUntil: "networkidle" });
console.log("loaded ms", Date.now() - t0, "final", page.url());
await page.screenshot({ path: out, fullPage: true });
const items = await page.$$eval("a,button,[role=button],[role=tab]", (els) =>
  els.filter((e) => (e as HTMLElement).offsetParent).map((e) => `${e.tagName} ${(e.getAttribute("href") ?? "")} | ${(e.textContent ?? "").trim().slice(0, 60)}`));
console.log(items.join("\n"));
const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.documentElement.scrollHeight]);
console.log("scrollWidth/innerWidth/scrollHeight", sw);
await browser.close();
