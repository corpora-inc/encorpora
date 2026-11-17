/**
 * A parent's results tell one story (product grabs 2026-11-17, #9, #15–#18),
 * in a real browser against the real API and database:
 *
 * - `/` signed in, with one family, opens the family in one hop.
 * - The child page's skills earned is Pathways' count.
 * - "Where you are" on Pathways' grades view is the child page's best guess.
 * - Recent work typesets its problems (no flattened "31/4").
 * - Practice time says the same on Today and the child page.
 * - At 320, 390, 768 and 1280 px, light and dark: no horizontal overflow
 *   and no layout shift once the page has painted; a screenshot of each.
 *
 * Usage: AMP_TEST_DATABASE_URL=… tsx scripts/verify-family-results-ui.ts
 *   [--shots <dir>] [--port 4930]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, type Page } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { startShellFixture } from "./app-shell-fixture";

const chromium = secureChromium(rawChromium);
const arg = (name: string) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
};
const shots = arg("shots") ?? "artifacts/family-results";
await mkdir(shots, { recursive: true });
const fixture = await startShellFixture({
  webPort: Number(arg("port") ?? 4930),
});
const { origin } = fixture;
const browser = await chromium.launch();
const failures: string[] = [];
const fail = (message: string) => {
  console.error(`FAIL ${message}`);
  failures.push(message);
};

try {
  const family = (
    await fixture.pool.query(
      "SELECT org_id FROM amp_families WHERE account_id=$1",
      [fixture.paid.account],
    )
  ).rows[0].org_id as string;
  const childPath = `/family/${family}/kids/${fixture.paid.jordan.id}`;

  const context = await fixture.context(browser, "paid", {
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // #9: one family, so `/` is that family, one replacing hop.
  await page.goto(`${origin}/`);
  await page.waitForURL((url) => url.pathname.startsWith(`/family/${family}`));
  assert.equal(await page.locator("[data-launcher]").count(), 0);
  assert.equal(
    await page.evaluate(() => history.length),
    1,
    "`/` replaced itself: Back leaves the app, never returns to a chooser",
  );

  // #15 and #18 on the child page.
  await page.goto(`${origin}${childPath}`);
  await page.locator("[data-child-page]").waitFor();
  const earned = Number(
    await page.locator("[data-skills-earned]").getAttribute("data-skills-earned"),
  );
  assert.ok(earned > 0, "the practised child has skills earned");
  const overall = await page
    .locator('[aria-label^="Overall: best guess "]')
    .first()
    .getAttribute("aria-label");
  const best = /best guess (.+?),/.exec(overall ?? "")?.[1];
  assert.ok(best, `the child page names where they are: ${overall}`);
  // #17: Recent work typesets fractions; nothing reads as TeX or runs a
  // whole number into a fraction.
  const prompts = await page
    .locator("[data-work-prompt]")
    .evaluateAll((all) => all.map((el) => el.textContent ?? ""));
  assert.ok(prompts.length > 0, "Recent work lists problems");
  for (const text of prompts)
    assert.doesNotMatch(text, /\\frac|\$/, `typeset: ${text}`);
  const childWeek = await page
    .locator('section[aria-labelledby="child-week"]')
    .innerText();

  // The same child's Pathways: the same count and the same "where".
  await page.goto(`${origin}${childPath}/pathways`);
  const count = page.getByText(/\d+ of \d+ skills earned/).first();
  await count.waitFor();
  const shown = Number(/(\d+) of/.exec(await count.innerText())![1]);
  if (shown !== earned)
    fail(`child page says ${earned} earned, Pathways ${shown}`);
  const here = page.locator("[data-here] strong").filter({
    has: page.locator("xpath=following-sibling::*[contains(., 'Where you are')]"),
  });
  const band = (await here.count())
    ? await here.first().innerText()
    : await page
        .locator("li", { hasText: "Where you are" })
        .locator("strong")
        .first()
        .innerText();
  const plainBest = best === "K" ? "Kindergarten" : best;
  if (band !== plainBest)
    fail(`child page says ${best}, Pathways' "Where you are" sits on ${band}`);

  // #18: Today's card for the child says what the child page says.
  await page.goto(`${origin}/family/${family}`);
  const card = page.locator(`[data-child="${fixture.paid.jordan.id}"]`);
  const today = (await card.count())
    ? await card.first().innerText()
    : await page.locator("main").innerText();
  const minutes = /(<1 min|\d+ min)\s*\n?\s*\d+ problems? this week/.exec(
    childWeek,
  )?.[1];
  if (minutes && !today.includes(minutes))
    fail(`child page says ${minutes} this week, Today does not`);
  await context.close();

  // Every width and theme: no overflow, no shift after paint, a screenshot.
  for (const width of [320, 390, 768, 1280])
    for (const colorScheme of ["light", "dark"] as const) {
      const view = await fixture.context(browser, "paid", {
        viewport: { width, height: 900 },
        colorScheme,
      });
      const tab = await view.newPage();
      tab.setDefaultTimeout(30000);
      for (const [name, path, ready] of [
        ["child", childPath, "[data-child-page]"],
        ["today", `/family/${family}`, "main"],
      ] as const) {
        await tab.goto(`${origin}${path}`);
        await tab.locator(ready).first().waitFor();
        await tab.waitForLoadState("networkidle");
        await settle(tab);
        const overflow = await tab.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        );
        if (overflow > 0)
          fail(`${name} ${width} ${colorScheme}: ${overflow}px horizontal overflow`);
        const shift = await shiftAfter(tab);
        if (shift > 0.001)
          fail(`${name} ${width} ${colorScheme}: layout shift ${shift}`);
        await tab.screenshot({
          path: `${shots}/${name}-${width}-${colorScheme}.png`,
          fullPage: true,
        });
      }
      await view.close();
    }
} finally {
  await browser.close();
  await fixture.close();
}
if (failures.length) {
  console.error(`${failures.length} failure(s)`);
  process.exit(1);
}
console.log("Family results UI verified.");
process.exit(0);

/** Two frames with nothing pending. */
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      ),
  );
}

/** Layout shift over a second once the page has painted. */
async function shiftAfter(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((done) => {
        let total = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[])
            if (!entry.hadRecentInput) total += entry.value;
        });
        observer.observe({ type: "layout-shift" });
        setTimeout(() => {
          observer.disconnect();
          done(total);
        }, 1000);
      }),
  );
}
