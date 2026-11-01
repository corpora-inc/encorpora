/**
 * Lesson library findability, against the real API and catalog
 * (app-shell-fixture.ts): instant search over titles, summaries and glossary
 * terms, band sections, a sticky filter, the query and area in the URL, and
 * no movement of the controls while filtering.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_fixture \
 *     npx tsx scripts/verify-lesson-library-ui.ts [--engine webkit]
 *       [--widths 390,1280] [--shots DIR] [--production]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { probe, settle } from "./app-shell-probe";
import { startShellFixture } from "./app-shell-fixture";
import { choose } from "./ui-controls";

const argument = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
};
const engine = argument("engine") ?? "chromium";
const shots = argument("shots");
if (shots) await mkdir(shots, { recursive: true });
const widths = (argument("widths") ?? "320,390,768,1024,1280")
  .split(",")
  .map(Number);
const viewports = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
].filter((v) => widths.includes(v.width));
const fixture = await startShellFixture({
  production: process.argv.includes("--production"),
  webPort: Number(process.env.AMP_LIBRARY_WEB_PORT ?? 4970),
});
const { origin } = fixture;
const browser = await (engine === "webkit" ? webkit : chromium).launch();
const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};
const search = (page: Page) =>
  page.getByRole("searchbox", { name: "Search lessons" });
const summary = (page: Page) =>
  page.locator("section.lesson-index [role=status]").first();
const visibleRows = (page: Page) =>
  page
    .locator("[data-lesson-id], [data-template]")
    .evaluateAll(
      (rows) => rows.filter((row) => row.getClientRects().length > 0).length,
    );
async function open(
  viewport: { width: number; height: number },
  theme: "light" | "dark",
  path = "/lessons",
) {
  const context = await fixture.context(browser, "paid", {
    viewport,
    colorScheme: theme,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text()))
      errors.push(m.text());
  });
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  await search(page).waitFor();
  await page.locator("[data-lesson-id]").first().waitFor({ state: "attached" });
  await settle(page, 300);
  return { page, context, errors };
}

try {
  // 1. Every width and theme: fits, no overlaps, 44px targets, no broken
  //    words, with and without a query.
  for (const theme of ["light", "dark"] as const)
    for (const viewport of viewports) {
      const tag = `${viewport.width} ${theme}`;
      const { page, context, errors } = await open(viewport, theme);
      for (const state of ["all", "query"] as const) {
        if (state === "query") {
          await search(page).fill("fraction");
          await page.waitForURL(
            (url) => url.searchParams.get("q") === "fraction",
          );
          await settle(page, 300);
        }
        const found = await probe(page);
        check(
          found.overflow === 0,
          `${tag} ${state}: overflows ${found.overflow}px`,
        );
        check(
          !found.overlaps.length,
          `${tag} ${state}: overlaps ${found.overlaps.join("; ")}`,
        );
        check(
          !found.smallTargets.length,
          `${tag} ${state}: small targets ${found.smallTargets.join("; ")}`,
        );
        check(
          !found.midWordWraps.length,
          `${tag} ${state}: ${found.midWordWraps.join("; ")}`,
        );
        if (shots && (viewport.width === 390 || viewport.width === 1280))
          await page.screenshot({
            path: `${shots}/library-${state}-${viewport.width}-${theme}.png`,
          });
      }
      check(!errors.length, `${tag}: page errors ${errors.join("; ")}`);
      await context.close();
    }

  // 2. Search: instant, in the URL, refresh and share restore it; the bar
  //    and the count line never move while results change.
  {
    const { page, context } = await open({ width: 390, height: 844 }, "light");
    const all = await visibleRows(page);
    check(all > 500, `library lists every lesson and type (${all})`);
    const bar = page.locator("[role=search]");
    const before = {
      bar: await bar.boundingBox(),
      summary: await summary(page).boundingBox(),
    };
    for (const text of ["s", "sl", "slo", "slope"]) {
      await search(page).fill(text);
      await settle(page, 120);
      check(
        JSON.stringify(await bar.boundingBox()) === JSON.stringify(before.bar),
        `search bar moved while typing "${text}"`,
      );
      check(
        JSON.stringify(await summary(page).boundingBox()) ===
          JSON.stringify(before.summary),
        `result count moved while typing "${text}"`,
      );
    }
    await page.waitForURL((url) => url.searchParams.get("q") === "slope");
    const sloped = await visibleRows(page);
    check(sloped > 0 && sloped < all, `"slope" narrows the list (${sloped})`);
    check(
      /match “slope”/.test(await summary(page).innerText()),
      "the count names the query",
    );
    await page.reload();
    await search(page).waitFor();
    await settle(page, 300);
    check(
      (await search(page).inputValue()) === "slope",
      "refresh keeps the query",
    );
    check((await visibleRows(page)) === sloped, "refresh keeps the results");
    // Opening a lesson and going back returns to the same results, with
    // focus on the lesson that was opened.
    const first = page.locator("[data-lesson-id]:visible").first();
    const id = await first.getAttribute("data-lesson-id");
    await first.click();
    await page.waitForURL(`**/lessons/${encodeURIComponent(id!)}`);
    await page.locator(".lesson-reader").waitFor();
    await page.getByRole("button", { name: "← All lessons" }).click();
    await page.waitForURL((url) => url.searchParams.get("q") === "slope");
    await settle(page, 300);
    check(
      (await search(page).inputValue()) === "slope",
      "reader back keeps the query",
    );
    check(
      await page.evaluate(
        (lesson) =>
          document.activeElement?.getAttribute("data-lesson-id") === lesson,
        id,
      ),
      "reader back returns focus to the lesson",
    );
    // Browser back from a lesson restores the results too.
    await page.locator("[data-lesson-id]:visible").first().click();
    await page.locator(".lesson-reader").waitFor();
    await page.goBack();
    await search(page).waitFor();
    check(
      (await search(page).inputValue()) === "slope",
      "Back keeps the query",
    );
    // Escape and the clear control empty the field and the URL.
    await search(page).press("Escape");
    await page.waitForURL((url) => !url.searchParams.has("q"));
    await settle(page, 300);
    const afterEscape = await visibleRows(page);
    check(
      afterEscape === all,
      `Escape shows everything again (${afterEscape} of ${all})`,
    );
    await search(page).fill("zzzq");
    await settle(page, 200);
    check(
      /Nothing matches “zzzq”/.test(await summary(page).innerText()),
      "an empty result says so and what to try",
    );
    await page.getByRole("button", { name: "Clear search" }).click();
    check((await search(page).inputValue()) === "", "clear empties the field");
    check(
      await search(page).evaluate((el) => el === document.activeElement),
      "clear keeps focus in the field",
    );
    await context.close();
  }

  // 3. Glossary terms: a math word finds the lessons that use it and shows
  //    its plain definition.
  {
    const { page, context } = await open({ width: 1280, height: 800 }, "light");
    await search(page).fill("hypotenuse");
    const words = page.getByRole("list", { name: "Math words" });
    await words.waitFor();
    check(
      /hypotenuse/i.test(await words.innerText()),
      "the definition of the searched word is shown",
    );
    check((await visibleRows(page)) > 0, "lessons using the word are listed");
    await context.close();
  }

  // 4. Area filter: in the URL, Back and Forward restore it.
  {
    const { page, context } = await open({ width: 768, height: 1024 }, "light");
    const all = await visibleRows(page);
    await choose(page.getByRole("button", { name: "Math area" }), "geometry");
    await page.waitForURL(
      (url) => url.searchParams.get("strand") === "geometry",
    );
    await settle(page, 200);
    const geometry = await visibleRows(page);
    check(
      geometry > 0 && geometry < all,
      `area narrows the list (${geometry})`,
    );
    check(
      await page
        .locator("[data-strand]:visible")
        .evaluateAll((rows) =>
          rows.every((row) => row.getAttribute("data-strand") === "geometry"),
        ),
      "only geometry rows are visible",
    );
    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has("strand"));
    await settle(page, 200);
    check((await visibleRows(page)) === all, "Back restores every area");
    await page.goForward();
    await page.waitForURL(
      (url) => url.searchParams.get("strand") === "geometry",
    );
    await settle(page, 200);
    check((await visibleRows(page)) === geometry, "Forward restores the area");
    // A band section folds and unfolds without leaving the page.
    const band = page.locator("section[data-band]:visible").first();
    const toggle = band.getByRole("button", { expanded: true });
    await toggle.click();
    check(
      (await band.getByRole("button", { expanded: false }).count()) === 1,
      "a band section folds",
    );
    check(
      (await band
        .locator("[data-lesson-id]:visible, [data-template]:visible")
        .count()) === 0,
      "a folded section hides its rows",
    );
    await band.getByRole("button", { expanded: false }).click();
    await context.close();
  }

  // 5. The filter stays pinned under the app's tabs while the list scrolls.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    const { page, context } = await open(viewport, "light");
    await page.evaluate(() => window.scrollTo(0, 3000));
    await settle(page, 200);
    const pin = await page.evaluate(() => {
      const bar = document
        .querySelector("[role=search]")!
        .getBoundingClientRect();
      const nav = document
        .querySelector('nav[aria-label="Learning sections"]')!
        .getBoundingClientRect();
      return { top: bar.top, navBottom: nav.bottom, visible: bar.bottom > 0 };
    });
    check(pin.visible, `${viewport.width}: the filter scrolls away`);
    check(
      pin.top >= pin.navBottom - 1 && pin.top <= pin.navBottom + 24,
      `${viewport.width}: the filter is not pinned under the tabs (${Math.round(pin.top)} vs ${Math.round(pin.navBottom)})`,
    );
    await context.close();
  }

  // 6. A problem type still opens its short lesson and practice.
  {
    const { page, context } = await open({ width: 390, height: 844 }, "light");
    await choose(page.getByRole("button", { name: "Math area" }), "data");
    const topic = page
      .locator(".topic-list:not([hidden]) [data-template]:visible")
      .first();
    await topic.click();
    await page
      .getByRole("button", { name: "Practice this", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "← All lessons" }).click();
    await page.waitForURL((url) => url.searchParams.get("strand") === "data");
    await search(page).waitFor();
    await context.close();
  }
} finally {
  await browser.close();
  await fixture.close();
}
assert.deepEqual(failures, [], `Lesson library:\n${failures.join("\n")}`);
console.log(`Lesson library verified in ${engine}.`);
process.exit(0);
