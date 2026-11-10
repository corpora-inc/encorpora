import { secureChromium } from "../browser-security.mjs";
/**
 * Lesson library findability, against the real API and catalog
 * (app-shell-fixture.ts): instant search with ranked results grouped as
 * Lessons, Skills and Glossary (lexical at once, blended with nearest
 * neighbours by the API, lexical again offline), matched words marked,
 * arrow-key navigation, band sections, a sticky filter, the query and area in
 * the URL, and no movement of the controls while filtering.
 *
 *   AMP_TEST_DATABASE_URL=postgres://…/amp_fixture \
 *     npx tsx scripts/verify-lesson-library-ui.ts [--engine webkit]
 *       [--widths 390,1280] [--shots DIR] [--production]
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
const chromium = secureChromium(rawChromium);
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
async function queryReady(page: Page, query: string) {
  await page.waitForURL((url) =>
    query ? url.searchParams.get("q") === query : !url.searchParams.has("q"),
  );
  // Search results use a deferred value, so the input/URL can be ahead of
  // the committed result list. Wait for that query's summary, not elapsed time,
  // and for the API's answer (the results stop being busy).
  await summary(page)
    .filter({
      hasText: query
        ? new RegExp(
            `(match|matches) “${(query.length > 24 ? `${query.slice(0, 23).trimEnd()}…` : query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}”`,
          )
        : /^\d{1,3}(?:,\d{3})* lessons? · \d{1,3}(?:,\d{3})* problem types?$/,
    })
    .waitFor();
  if (query)
    await page.locator("[data-search-results][aria-busy=false]").waitFor();
}
const glossary = (page: Page) => page.getByRole("list", { name: "Glossary" });
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
          await queryReady(page, "fraction");
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
        if (shots && [320, 390, 768, 1280].includes(viewport.width))
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
    // The field sits flush in its frame: one border, not a box in a box.
    check(
      (await search(page).evaluate(
        (el) => getComputedStyle(el).borderTopWidth,
      )) === "0px",
      "the search field draws a second border inside its frame",
    );
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
    // Fast typing: every keystroke lands, though the URL follows behind.
    await search(page).fill("");
    await search(page).pressSequentially("pythagorean", { delay: 5 });
    await settle(page, 300);
    check(
      (await search(page).inputValue()) === "pythagorean",
      `fast typing lost keystrokes: "${await search(page).inputValue()}"`,
    );
    await page.waitForURL((url) => url.searchParams.get("q") === "pythagorean");
    await search(page).fill("slope");
    await queryReady(page, "slope");
    // The first search lazily loads glossary terms. Include that result set
    // before capturing the count that a reload must restore.
    await glossary(page).waitFor();
    const sloped = await visibleRows(page);
    check(sloped > 0 && sloped < all, `"slope" narrows the list (${sloped})`);
    check(
      /match “slope”/.test(await summary(page).innerText()),
      "the count names the query",
    );
    await page.reload();
    await search(page).waitFor();
    await queryReady(page, "slope");
    await glossary(page).waitFor();
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
    // The lesson reads at the shared rhythm (lesson-reading.css): body copy
    // at a line height of at least 1.6, within the page's width.
    const reading = await page.evaluate(() => {
      const prose = [
        ...document.querySelectorAll<HTMLElement>(
          ".reference-lesson p, .reference-lesson li",
        ),
      ];
      return {
        tight: prose.filter((el) => {
          const style = getComputedStyle(el);
          return (
            parseFloat(style.lineHeight) / parseFloat(style.fontSize) < 1.595
          );
        }).length,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });
    check(reading.tight === 0, `${reading.tight} lesson lines are tight`);
    check(reading.overflow <= 1, `the lesson overflows by ${reading.overflow}`);
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
    await queryReady(page, "");
    const afterEscape = await visibleRows(page);
    check(
      afterEscape === all,
      `Escape shows everything again (${afterEscape} of ${all})`,
    );
    await search(page).fill("zzzq");
    await queryReady(page, "zzzq");
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
    const words = glossary(page);
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
    // Curriculum grouping is optional; revealing it preserves all rows.
    await page.getByRole("checkbox", { name: "Show grade numbers" }).check();
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

  // 5. The filter stays pinned under the shared app bar while the list scrolls.
  for (const theme of ["light", "dark"] as const)
    for (const viewport of viewports) {
      const { page, context } = await open(viewport, theme);
      await page.evaluate(() => window.scrollTo(0, 3000));
      await settle(page, 200);
      const pin = await page.evaluate(() => {
        const bar = document
          .querySelector("[role=search]")!
          .getBoundingClientRect();
        const nav = document
          .querySelector("[data-app-bar]")!
          .getBoundingClientRect();
        return { top: bar.top, navBottom: nav.bottom, visible: bar.bottom > 0 };
      });
      check(pin.visible, `${viewport.width}: the filter scrolls away`);
      check(
        pin.top >= pin.navBottom - 1 && pin.top <= pin.navBottom + 24,
        `${viewport.width}: the filter is not pinned under the app bar (${Math.round(pin.top)} vs ${Math.round(pin.navBottom)})`,
      );
      if (shots && [320, 390, 768, 1280].includes(viewport.width))
        await page.screenshot({
          path: `${shots}/library-pinned-${viewport.width}-${theme}.png`,
        });
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
  // 7. Ranked search: groups in order, matched words marked, arrow keys move
  //    through results, nearest neighbours answer a question with no shared
  //    words, and with the API unreachable the device answers lexically.
  for (const theme of ["light", "dark"] as const)
    for (const viewport of viewports.filter((v) =>
      [390, 1280].includes(v.width),
    )) {
      const tag = `${viewport.width} ${theme}`;
      const { page, context } = await open(viewport, theme);
      await search(page).fill("slope");
      await queryReady(page, "slope");
      const groups = await page
        .locator("[data-search-results] h2")
        .allInnerTexts();
      check(
        JSON.stringify(groups) ===
          JSON.stringify(["LESSONS", "SKILLS", "GLOSSARY"]) ||
          JSON.stringify(groups) ===
            JSON.stringify(["Lessons", "Skills", "Glossary"]),
        `${tag}: groups ${groups.join(", ")}`,
      );
      check(
        (await page.locator("[data-result] mark").count()) > 0,
        `${tag}: matched words are marked`,
      );
      const found = await probe(page);
      check(
        found.overflow === 0,
        `${tag} results: overflows ${found.overflow}px`,
      );
      check(
        !found.overlaps.length,
        `${tag} results: overlaps ${found.overlaps.join("; ")}`,
      );
      check(
        !found.midWordWraps.length,
        `${tag} results: ${found.midWordWraps.join("; ")}`,
      );
      if (shots)
        await page.screenshot({
          path: `${shots}/search-slope-${viewport.width}-${theme}.png`,
        });
      // Arrow keys: into the results, along them, and back to the field.
      await search(page).focus();
      await page.keyboard.press("ArrowDown");
      const first = await page.evaluate(() =>
        document.activeElement?.hasAttribute("data-result"),
      );
      check(first, `${tag}: ArrowDown moves into the results`);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowUp");
      await page.keyboard.press("ArrowUp");
      check(
        await search(page).evaluate((el) => el === document.activeElement),
        `${tag}: ArrowUp from the first result returns to the field`,
      );
      // A question that shares no word with its lessons.
      const semantic = await page.evaluate(async () => {
        const response = await fetch("/api/v1/search?q=pizza");
        return ((await response.json()) as { semantic: boolean }).semantic;
      });
      if (semantic) {
        await search(page).fill("how do I split a pizza fairly");
        await queryReady(page, "how do I split a pizza fairly");
        const lessons = await page
          .locator("[data-search-results] section")
          .first()
          .locator("[data-result]")
          .allInnerTexts();
        check(
          lessons
            .slice(0, 5)
            .some((text) => /half|halves|equal|share|part/i.test(text)),
          `${tag}: the pizza question finds equal shares (${lessons.slice(0, 3).join(" | ")})`,
        );
        if (shots)
          await page.screenshot({
            path: `${shots}/search-pizza-${viewport.width}-${theme}.png`,
          });
      } else
        console.log(
          "The API has no search model here; skipped the neighbour check.",
        );
      // No results: what to try instead.
      await search(page).fill("zzzq");
      await queryReady(page, "zzzq");
      check(
        await page.getByRole("button", { name: "times tables" }).isVisible(),
        `${tag}: no results suggest searches that work`,
      );
      if (shots)
        await page.screenshot({
          path: `${shots}/search-empty-${viewport.width}-${theme}.png`,
        });
      await context.close();
    }
  {
    // Offline: the API's search fails, the device's index answers, and the
    // failure is logged.
    const { page, context, errors } = await open(
      { width: 390, height: 844 },
      "light",
    );
    await page.route("**/api/v1/search*", (route) => route.abort());
    await search(page).fill("times tables");
    await queryReady(page, "times tables");
    check((await visibleRows(page)) > 0, "offline search still lists lessons");
    check(
      errors.some((e) => /answering from this device/.test(e)),
      "the failed search request is logged",
    );
    await context.close();
  }
} finally {
  await browser.close();
  await fixture.close();
}
assert.deepEqual(failures, [], `Lesson library:\n${failures.join("\n")}`);
console.log(`Lesson library verified in ${engine}.`);
process.exit(0);
