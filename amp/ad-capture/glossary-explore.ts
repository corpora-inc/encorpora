import { chromium } from "playwright";
import { serve } from "./glossary-server";
const out = "/private/tmp/claude-501/-Users-skyl-Code-corpora-encorpora/3ae28322-836f-4cbf-a397-7dcb7deee7e2/scratchpad/explore";
const s = await serve();
const browser = await chromium.launch();
try {
  for (const [vp, dpr] of [[{ width: 390, height: 844 }, 1], [{ width: 1024, height: 768 }, 1]] as const)
    for (const mode of ["why", "wrong", "lesson"]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: dpr, colorScheme: "light", hasTouch: vp.width < 768, isMobile: vp.width < 768 });
      const page = await ctx.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
      await page.goto(s.url(mode));
      await page.waitForTimeout(1500);
      if (mode === "why") await page.getByRole("button", { name: "See why" }).click().catch((e) => errors.push(String(e)));
      if (mode === "lesson") { const b = page.getByRole("button", { name: /lesson/i }).first(); console.log(await b.textContent().catch(() => "no btn")); await b.click().catch((e) => errors.push(String(e))); }
      await page.waitForTimeout(1200);
      const terms = await page.locator(".glossary-term").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.termId + ":" + e.textContent));
      console.log(vp.width, mode, terms, errors);
      await page.screenshot({ path: `${out}/${vp.width}-${mode}.png` });
      await ctx.close();
    }
} finally { await browser.close(); await s.close(); }
