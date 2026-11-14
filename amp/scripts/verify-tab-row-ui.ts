/** The app bar's tab row on a phone (ui/Tabs.tsx): for the longest label set
 * each kind of place has (a teacher's class, a family, a tutor's class, a
 * school's admin, a district), with the open tab shown and held under More,
 * at 320–412 px: every shown tab whole and inside the gutters, no sideways
 * scroll, no fading edge, and More openable without moving the row.
 *
 *     npx tsx scripts/verify-tab-row-ui.ts [--port 4956]
 */
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";

const at = process.argv.indexOf("--port");
const port = at > 0 ? Number(process.argv[at + 1]) : 4956;
const origin = `http://127.0.0.1:${port}`;
const vite = await createServer({
  ...(process.env.AMP_VITE_CACHE_DIR
    ? { cacheDir: process.env.AMP_VITE_CACHE_DIR }
    : {}),
  root: fileURLToPath(new URL("../", import.meta.url)),
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
  server: { host: "127.0.0.1", port, strictPort: true },
});
await vite.listen();
const browser = await secureChromium(rawChromium).launch({ headless: true });
const rows = {
  teacher: ["today", "settings"],
  family: ["today", "settings"],
  tutor: ["today", "settings"],
  admin: ["overview", "settings"],
  district: ["overview", "settings"],
} as const;
let checked = 0;
try {
  for (const theme of ["light", "dark"] as const)
    for (const width of [320, 360, 390, 412]) {
      const context = await browser.newContext({
        viewport: { width, height: 700 },
        colorScheme: theme,
      });
      const page = await context.newPage();
      for (const [kind, opens] of Object.entries(rows))
        for (const open of opens) {
          const tag = `${kind} (${open} open) at ${width} ${theme}`;
          await page.goto(
            `${origin}/design?frame=specimen&specimen=tab-row-${kind}-${open}&theme=${theme}`,
          );
          await page.locator("[data-tab-row] [data-tabs]").waitFor();
          await page.waitForTimeout(150);
          const row = await page.evaluate(() => {
            const strip = document.querySelector<HTMLElement>(
              "[data-tab-row] [data-tabs]",
            )!;
            const bar = strip.closest("header")!;
            const inset = parseFloat(getComputedStyle(bar).paddingLeft);
            const shown = [
              ...strip.querySelectorAll<HTMLElement>(
                "[data-tab]:not([data-hidden]), [data-tabs-more] button",
              ),
            ].filter((el) => el.getClientRects().length > 0);
            const words = shown.map((el) => {
              const range = document.createRange();
              range.selectNodeContents(el);
              const box = range.getBoundingClientRect();
              return {
                text: el.textContent ?? "",
                left: box.left,
                right: box.right,
                whole: el.scrollWidth <= el.clientWidth + 1,
                open:
                  el.getAttribute("aria-current") === "page" ||
                  /, more /.test(el.getAttribute("aria-label") ?? ""),
              };
            });
            return {
              inset,
              view: innerWidth,
              scrolls: strip.scrollWidth > strip.clientWidth + 1,
              faded: getComputedStyle(strip).maskImage !== "none",
              page: document.documentElement.scrollWidth,
              words,
            };
          });
          assert.ok(!row.scrolls, `${tag}: the row never scrolls`);
          assert.ok(!row.faded, `${tag}: no fading edge`);
          assert.ok(row.page <= row.view, `${tag}: no page overflow`);
          assert.ok(
            row.words.length >= 4,
            `${tag}: at least three tabs and More`,
          );
          for (const w of row.words) {
            assert.ok(w.whole, `${tag}: "${w.text}" is whole`);
            assert.ok(
              w.left >= row.inset - 1 && w.right <= row.view - row.inset + 1,
              `${tag}: "${w.text}" sits inside the gutters (${Math.round(w.left)}–${Math.round(w.right)} of ${row.view})`,
            );
          }
          assert.ok(
            row.words.some((w) => w.open),
            `${tag}: the open tab is marked, shown or under More`,
          );
          // Opening More never moves the row.
          const more = page.locator("[data-tab-row] [data-tabs-more] button");
          if (await more.isVisible()) {
            const before = await page
              .locator("[data-tab-row] [data-tab]:not([data-hidden])")
              .first()
              .boundingBox();
            await more.click();
            await page.getByRole("menu").waitFor();
            const after = await page
              .locator("[data-tab-row] [data-tab]:not([data-hidden])")
              .first()
              .boundingBox();
            assert.equal(
              Math.round(after!.x),
              Math.round(before!.x),
              `${tag}: More opens without moving the row`,
            );
            await page.keyboard.press("Escape");
          }
          if (process.env.AMP_TAB_ROW_SHOTS)
            await page.screenshot({
              path: `${process.env.AMP_TAB_ROW_SHOTS}/tab-row-${kind}-${open}-${width}-${theme}.png`,
              clip: { x: 0, y: 0, width, height: 120 },
            });
          checked++;
        }
      await context.close();
    }
  console.info(
    `Phone tab rows: ${checked} rows whole, inside the gutters, no scroll or fade.`,
  );
} finally {
  await browser.close();
  await vite.close();
}
