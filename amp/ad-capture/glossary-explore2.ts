import { chromium } from "playwright";
import { serve } from "./glossary-server";
const s = await serve();
const browser = await chromium.launch();
const DUMP = `(() => { const out = [];
  const walk = (el, d) => { if (d > 7) return; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    out.push("  ".repeat(d) + el.tagName.toLowerCase() + "." + String(el.className).replace(/ /g, ".") + " [" + Math.round(r.x) + "," + Math.round(r.y) + " " + Math.round(r.width) + "x" + Math.round(r.height) + "] pos=" + cs.position + " ovf=" + cs.overflowY + " st=" + el.scrollTop + "/" + el.scrollHeight);
    for (const c of el.children) if (!["svg","li","span","strong"].includes(c.tagName.toLowerCase())) walk(c, d + 1); };
  walk(document.getElementById("root"), 0); return out.join("\\n"); })()`;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "light", hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.route("**/api/**", (r) => r.fulfill({ status: 204, body: "" }));
  await page.goto(s.url("why"));
  await page.waitForTimeout(1500);
  console.log(await page.evaluate(DUMP));
  await page.screenshot({ path: "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/3ae28322-836f-4cbf-a397-7dcb7deee7e2/scratchpad/explore/390-correct.png" });
  await page.getByRole("button", { name: "See why" }).click();
  await page.waitForTimeout(800);
  console.log("---- after see why");
  console.log(await page.evaluate(DUMP));
} finally { await browser.close(); await s.close(); }
