/** Prove Linux CI's configured UI font in the actual sandboxed browser. */
import assert from "node:assert/strict";
import { chromium as rawChromium } from "playwright-core";
import { secureChromium } from "../browser-security.mjs";

const expected = process.env.AMP_EXPECT_UI_FONT;
assert.ok(expected, "AMP_EXPECT_UI_FONT is required");
const browser = await secureChromium(rawChromium).launch();
try {
  const page = await browser.newPage();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const results = [];
  for (const family of [
    "system-ui",
    "sans-serif",
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
    'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
    "monospace",
    "serif",
  ]) {
    for (const weight of [400, 700]) {
      await page.setContent("<p id='sample'>Find the mean of these numbers: 7, 9, 22, 23, 8.</p>");
      await page.locator("#sample").evaluate((element, style) => {
        element.style.fontFamily = style.family;
        element.style.fontWeight = String(style.weight);
        // Flush the style change before waiting for the selected face to load.
        element.getBoundingClientRect();
      }, { family, weight });
      await page.evaluate(() => document.fonts.ready);
      const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
      const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#sample" });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      assert.ok(fonts.length > 0 && fonts.every((font) => font.glyphCount > 0));
      if (family === "monospace" || family === "serif") {
        assert.ok(fonts.every((font) => font.familyName !== expected), `UI override must preserve ${family}`);
      } else {
        assert.ok(fonts.every((font) => font.familyName === expected), `${family}/${weight} renders in ${JSON.stringify(fonts)}, expected ${expected}`);
      }
      results.push({ family, weight, fonts });
    }
  }
  console.log(JSON.stringify({ browser: browser.version(), checks: results.length, results }));
} finally {
  await browser.close();
}
