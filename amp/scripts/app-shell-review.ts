import assert from "node:assert/strict";
import type { Browser, Page } from "playwright";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import type { startShellFixture } from "./app-shell-fixture";
import { settle } from "./app-shell-probe";
import { choose, navigateApp } from "./ui-controls";

type Box = { x: number; y: number; width: number; height: number } | null;
/** Two boxes in the same place, to half a pixel. */
const sameBox = (
  a: Box,
  b: Box,
  keys: readonly ("x" | "y" | "width" | "height")[] = [
    "x",
    "y",
    "width",
    "height",
  ],
) => !!a && !!b && keys.every((key) => Math.abs(a[key] - b[key]) <= 0.5);
const boxOf = async (page: Page, selector: string) => {
  const found = page.locator(selector).first();
  return (await found.count()) ? found.boundingBox() : null;
};
/** "870 lessons · 1,189 problem types": every count uses en-US grouping. */
const groupedCatalog =
  /^\d{1,3}(?:,\d{3})* lessons · \d{1,3}(?:,\d{3})* problem types$/;
async function assertGroupedCatalog(page: Page, tag: string) {
  const text = (await page.locator(".lesson-index [role=status]").innerText())
    .replace(/\s+/g, " ")
    .trim();
  assert.match(
    text,
    groupedCatalog,
    `${tag}: lesson counts are not grouped (${text})`,
  );
}
const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const contrastRatio = (a: string, b: string) => {
  const parse = (css: string) => css.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  const left = parse(a),
    right = parse(b);
  if (!left || !right || left.length < 3 || right.length < 3) return 0;
  const lum = (rgb: number[]) =>
    0.2126 * channel(rgb[0]!) +
    0.7152 * channel(rgb[1]!) +
    0.0722 * channel(rgb[2]!);
  const x = lum(left),
    y = lum(right);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Area picker stays put, the selected segment is distinct, and the summary
 * does not leave one word on its last line. */
export async function assertProgressPolish(page: Page, tag: string) {
  const problems: string[] = [];
  const selected = await page.locator(".progress-filters").evaluate((root) => {
    const button = root.querySelector('[aria-pressed="true"]');
    return {
      track: getComputedStyle(root).backgroundColor,
      fill: button ? getComputedStyle(button).backgroundColor : "",
    };
  });
  const ratio = contrastRatio(selected.track, selected.fill);
  if (selected.fill === "" || selected.track === selected.fill || ratio < 1.5)
    problems.push(
      `selected segment ${selected.fill} on ${selected.track} is ${ratio.toFixed(2)}:1`,
    );
  const picker = page.locator(".progress-controls .premium-select");
  const before = (await picker.boundingBox())?.width ?? 0;
  await choose(picker, "data");
  await page.getByRole("dialog", { name: "Math area" }).waitFor({
    state: "hidden",
  });
  await picker.locator("span", { hasText: /^Data$/ }).waitFor();
  const after = (await picker.boundingBox())?.width ?? 0;
  if (Math.abs(before - after) > 0.5)
    problems.push(
      `area picker ${before.toFixed(1)}px → ${after.toFixed(1)}px after choosing Data`,
    );
  // The fixed width has to hold the longest name on a wide screen.
  await choose(picker, "modeling");
  await page.getByRole("dialog", { name: "Math area" }).waitFor({
    state: "hidden",
  });
  const longest = await picker.locator("span").first().evaluate((el) => ({
    text: el.textContent ?? "",
    clipped: el.scrollWidth > el.clientWidth + 1,
    wide: window.innerWidth >= 1000,
  }));
  if (longest.wide && (longest.clipped || longest.text !== "Mathematical models"))
    problems.push(
      `longest area “${longest.text}” ${longest.clipped ? "is clipped" : "was not selected"}`,
    );
  await choose(picker, "");
  await page.getByRole("dialog", { name: "Math area" }).waitFor({
    state: "hidden",
  });
  const summary = await page.locator(".progress-heading p").evaluate((el) => {
    const wrap =
      getComputedStyle(el).getPropertyValue("text-wrap").trim() ||
      getComputedStyle(el).textWrap;
    const node = el.firstChild;
    const text = node?.textContent ?? "";
    if (!node || node.nodeType !== Node.TEXT_NODE)
      return { wrap, lastWords: 0, text };
    const words = [...text.matchAll(/\S+/g)];
    const tops = words.map((word) => {
      const range = document.createRange();
      range.setStart(node, word.index ?? 0);
      range.setEnd(node, (word.index ?? 0) + word[0].length);
      return Math.round(range.getBoundingClientRect().top);
    });
    const last = tops.length ? Math.max(...tops) : 0;
    return {
      wrap,
      lastWords: tops.filter((top) => top === last).length,
      text,
    };
  });
  if (summary.wrap !== "balance" && summary.wrap !== "pretty")
    problems.push(`summary wrap is ${summary.wrap || "unset"}`);
  if (!summary.text.includes("tried") || summary.lastWords < 2)
    problems.push(
      `summary last line has ${summary.lastWords} word (${summary.text})`,
    );
  assert.deepEqual(problems, [], `${tag}: ${problems.join("; ")}`);
}
/** One line per label, inside its button: a count never drops below it. */
const wrappedLabels = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const box = button.getBoundingClientRect(),
          range = document.createRange();
        range.selectNodeContents(button);
        const lines = [...range.getClientRects()].filter((r) => r.width > 0);
        return (
          new Set(lines.map((r) => Math.round(r.top))).size > 1 ||
          lines.some((r) => r.left < box.left - 1 || r.right > box.right + 1)
        );
      })
      .map((button) => button.textContent ?? ""),
  );

/** Delayed and failed reads must preserve the screen's meaning and geometry. */
export async function verifyShellReview({
  browser,
  fixture,
  viewports,
  shots,
  engine,
  only,
}: {
  browser: Browser;
  fixture: Awaited<ReturnType<typeof startShellFixture>>;
  viewports: { width: number; height: number }[];
  shots?: string;
  engine: string;
  only?: string;
}) {
  const failures: string[] = [];
  for (const viewport of viewports)
    for (const colorScheme of ["light", "dark"] as const)
      for (const kind of [
        "learner-return",
        "library-search",
        "practice-title",
        "library-loading",
        "library-reader-loading",
        "library-retry",
        "library-typing",
        "progress-loading",
        "progress-filters",
        "progress-large-text",
      ] as const) {
        const polish = [
          "library-search",
          "library-loading",
          "library-retry",
          "library-typing",
          "progress-filters",
        ];
        if (
          only === "review-edges"
            ? !["library-search", "progress-large-text"].includes(kind)
            : only === "polish"
              ? !polish.includes(kind)
              : only && only !== kind
        )
          continue;
        const context = await fixture.context(
          browser,
          kind === "learner-return" ? "starter" : "paid",
          { viewport, colorScheme },
        );
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        let release = () => {};
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const tag = `${kind} ${viewport.width} ${colorScheme}`;
        try {
          if (kind === "learner-return") {
            // A new learner back on their Overview after a problem: the map
            // holds its place while it refreshes, and after.
            await page.goto(`${fixture.origin}/overview`);
            const map = page.locator(".frontier-map");
            await page.locator('.frontier-map[aria-busy="false"]').waitFor();
            const before = await map.boundingBox();
            await page.locator(".go-button:not([disabled])").click();
            await page.getByRole("button", { name: /^Skip/ }).waitFor();
            await page.route("**/api/v1/learners/*/frontier", async (route) => {
              await held;
              await route.continue();
            });
            await page.getByRole("button", { name: /^Skip/ }).click();
            await page.getByRole("button", { name: /^Next/ }).waitFor();
            const refreshed = page.waitForResponse((response) =>
              response.url().endsWith("/frontier"),
            );
            await page.getByRole("button", { name: "Open AMP menu" }).click();
            await page
              .getByRole("link", { name: "Progress", exact: true })
              .click({ noWaitAfter: true });
            await page.waitForURL("**/overview");
            await map.waitFor();
            await settle(page, 350);
            assert.ok(
              sameBox(await map.boundingBox(), before),
              `${tag}: the map moved while it refreshed`,
            );
            release();
            await (await refreshed).finished();
            await page.locator('.frontier-map[aria-busy="false"]').waitFor();
            await settle(page, 200);
            assert.ok(
              sameBox(await map.boundingBox(), before),
              `${tag}: the refreshed map moved`,
            );
          } else if (kind === "library-search") {
            await page.goto(`${fixture.origin}/lessons`);
            const field = page.getByRole("searchbox", {
              name: "Search lessons",
            });
            await field.waitFor();
            await page.locator("[data-lesson-id]").first().waitFor();
            await assertGroupedCatalog(page, tag);
            assert.equal(
              await page.evaluate(() =>
                Number.parseFloat(
                  getComputedStyle(document.documentElement).scrollPaddingTop,
                ),
              ),
              (await page.locator("[data-app-bar]").boundingBox())!.height,
              `${tag}: the focus inset must match the actual app bar`,
            );
            await page.evaluate(() => window.scrollTo(0, 300));
            await settle(page, 100);
            const before = (await field.boundingBox())!.y;
            await field.click();
            for (const value of [
              "fraction",
              "fract",
              "zzzxq-nothing",
              "how to find a percent of a number",
              "hypotenuse",
              "",
            ]) {
              const beforeFilter = await page.evaluate(() => {
                const bar = document.querySelector('[role="search"]')!;
                return {
                  scroll: scrollY,
                  body: bar.parentElement!.getBoundingClientRect().top,
                  bar: bar.getBoundingClientRect().top,
                  height: document.documentElement.scrollHeight,
                };
              });
              await page.keyboard.press("ControlOrMeta+A");
              if (value) await page.keyboard.insertText(value);
              else await page.keyboard.press("Backspace");
              await page.waitForURL(
                (url) => (url.searchParams.get("q") ?? "") === value,
              );
              await settle(page, 200);
              assert.equal(
                (await field.boundingBox())!.y,
                before,
                `${tag} (${value}): typing moved the pinned search; before ${JSON.stringify(beforeFilter)}; after ${JSON.stringify(
                  await page.evaluate(() => {
                    const bar = document.querySelector('[role="search"]')!;
                    return {
                      scroll: scrollY,
                      body: bar.parentElement!.getBoundingClientRect().top,
                      bar: bar.getBoundingClientRect().top,
                      height: document.documentElement.scrollHeight,
                    };
                  }),
                )}`,
              );
              assert.equal(
                await field.evaluate((el) => document.activeElement === el),
                true,
              );
              const controls = await page.getByRole("search").boundingBox();
              const summary = await page
                .locator(".lesson-index [role=status]")
                .boundingBox();
              assert.ok(
                controls &&
                  summary &&
                  summary.y >= controls.y + controls.height - 1,
                `${tag}: the filtered result summary must be below the pinned controls`,
              );
              // A long query never clips the count or its advice.
              assert.equal(
                await page
                  .locator(".lesson-index [role=status]")
                  .evaluate(
                    (line) =>
                      line.scrollHeight <= line.clientHeight + 1 &&
                      getComputedStyle(line).overflow === "visible",
                  ),
                true,
                `${tag} (${value}): the result summary is clipped`,
              );
              if (shots && value === "zzzxq-nothing")
                await page.screenshot({
                  path: `${shots}/${engine}-library-empty-${viewport.width}-${colorScheme}.png`,
                });
            }
          } else if (kind === "library-typing") {
            // Typing a word letter by letter: once a query's results paint,
            // nothing under the field moves until the next letter. Every
            // frame records the summary line and the first result card.
            await page.goto(`${fixture.origin}/lessons`);
            const field = page.getByRole("searchbox", {
              name: "Search lessons",
            });
            await field.waitFor();
            await page.locator("[data-lesson-id]").first().waitFor();
            await assertGroupedCatalog(page, tag);
            await settle(page, 300);
            await page.evaluate(() => {
              const record = window as unknown as {
                __frames: unknown[];
                __stop?: boolean;
              };
              record.__frames = [];
              const tick = () => {
                const summary = document.querySelector(
                  ".lesson-index [role=status]",
                );
                let first: Element | null = null;
                for (const row of document.querySelectorAll(
                  ".lesson-index [data-lesson-id], .lesson-index [data-template]",
                ))
                  if (row.getClientRects().length) {
                    first = row;
                    break;
                  }
                const s = summary?.getBoundingClientRect();
                const f = first?.getBoundingClientRect();
                const text = summary?.textContent ?? "";
                record.__frames.push({
                  // The query whose results are painted, as the count names it.
                  query: /“(.*)”/.exec(text)?.[1] ?? "",
                  summary: s ? [s.y, s.height] : null,
                  first: first
                    ? `${first.getAttribute("data-lesson-id") ?? first.getAttribute("data-template")}`
                    : null,
                  card: f ? [f.x, f.y, f.width, f.height] : null,
                  scroll: scrollY,
                });
                if (!record.__stop) requestAnimationFrame(tick);
              };
              requestAnimationFrame(tick);
            });
            await field.click();
            await page.keyboard.type("fraction", { delay: 90 });
            await page.waitForURL(
              (url) => url.searchParams.get("q") === "fraction",
            );
            // Well past the glossary's late arrival (about 470 ms on main).
            await settle(page, 1500);
            type Frame = {
              query: string;
              summary: number[] | null;
              first: string | null;
              card: number[] | null;
              scroll: number;
            };
            const frames = await page.evaluate(() => {
              const record = window as unknown as {
                __frames: unknown[];
                __stop?: boolean;
              };
              record.__stop = true;
              return record.__frames as Frame[];
            });
            const problems: string[] = [];
            assert.ok(frames.length > 30, `${tag}: too few frames recorded`);
            assert.equal(
              frames.at(-1)!.query,
              "fraction",
              `${tag}: the last frame shows the typed query`,
            );
            for (let i = 1; i < frames.length; i++) {
              const [a, b] = [frames[i - 1]!, frames[i]!];
              if (JSON.stringify(a.summary) !== JSON.stringify(b.summary))
                problems.push(
                  `frame ${i}: the result summary moved or changed height ${JSON.stringify(a.summary)} → ${JSON.stringify(b.summary)} (“${b.query}”)`,
                );
              if (a.scroll !== b.scroll)
                problems.push(`frame ${i}: the page scrolled while typing`);
              if (
                a.query === b.query &&
                (a.first !== b.first ||
                  JSON.stringify(a.card) !== JSON.stringify(b.card))
              )
                problems.push(
                  `frame ${i}: results for “${b.query}” moved after they painted: ${a.first} ${JSON.stringify(a.card)} → ${b.first} ${JSON.stringify(b.card)}`,
                );
            }
            assert.deepEqual(
              problems.slice(0, 6),
              [],
              `${tag}: ${problems.length} movement(s) while typing`,
            );
          } else if (kind === "library-reader-loading") {
            // A refresh of one lesson: the reader's frame paints at once and
            // the lesson fills it; no page-sized heading in between.
            const lesson = lessons[0]!;
            await page.route("**/api/v1/catalog", async (route) => {
              await held;
              await route.continue();
            });
            await page.goto(
              `${fixture.origin}/lessons/${encodeURIComponent(lesson.id)}`,
              { waitUntil: "domcontentloaded" },
            );
            await page.locator('.library-main[aria-busy="true"]').waitFor();
            await settle(page, 150);
            const problems: string[] = [];
            const oversized = await page.evaluate(() =>
              [...document.querySelectorAll("main h1, main h2")]
                .filter(
                  (heading) =>
                    heading.getClientRects().length &&
                    Number.parseFloat(getComputedStyle(heading).fontSize) > 40,
                )
                .map((heading) => heading.textContent),
            );
            if (oversized.length)
              problems.push(
                `an oversized heading paints while the lesson loads: ${oversized.join(", ")}`,
              );
            const before = {
              reader: await boxOf(page, ".lesson-reader"),
              back: await boxOf(page, ".lesson-reader .card-top button"),
            };
            release();
            await page
              .locator('.lesson-reader:not([aria-busy="true"]) h2')
              .waitFor();
            await settle(page, 150);
            const after = {
              reader: await boxOf(page, ".lesson-reader"),
              back: await boxOf(page, ".lesson-reader .card-top button"),
            };
            if (!sameBox(before.reader, after.reader, ["x", "y", "width"]))
              problems.push(
                `the reader frame is not in place while the lesson loads: ${JSON.stringify(before.reader)} → ${JSON.stringify(after.reader)}`,
              );
            if (!sameBox(before.back, after.back))
              problems.push(
                `“All lessons” moved when the lesson arrived: ${JSON.stringify(before.back)} → ${JSON.stringify(after.back)}`,
              );
            // A problem type's short lesson needs no catalog: refreshed, it
            // opens while the catalog is still on its way.
            let releaseTopic = () => {};
            const topicHeld = new Promise<void>((resolve) => {
              releaseTopic = resolve;
            });
            await page.route("**/api/v1/catalog", async (route) => {
              await topicHeld;
              await route.continue();
            });
            try {
              await page.goto(
                `${fixture.origin}/lessons?topic=${encodeURIComponent(templates[0]!.id)}`,
                { waitUntil: "domcontentloaded" },
              );
              await page
                .locator(".lesson-sheet h2")
                .waitFor({ timeout: 8000 })
                .catch(() =>
                  problems.push(
                    "a refreshed short lesson waits for the catalog",
                  ),
                );
              if (
                await page
                  .getByRole("heading", { name: "Lessons", exact: true })
                  .count()
              )
                problems.push(
                  "a refreshed short lesson paints the library frame first",
                );
            } finally {
              releaseTopic();
            }
            assert.deepEqual(problems, [], tag);
          } else if (kind === "library-retry") {
            // A failed catalog: Lessons says so in place and offers Try
            // again, even after the family load re-runs on navigation.
            let allow = false,
              requests = 0;
            await page.route("**/api/v1/catalog", async (route) => {
              requests++;
              if (allow) await route.continue();
              else
                await route.fulfill({
                  status: 503,
                  json: { error: "temporarily_unavailable" },
                });
            });
            const logged: string[] = [];
            page.on("console", (message) => {
              if (
                message.type() === "error" &&
                !/Failed to load resource/.test(message.text())
              )
                logged.push(message.text());
            });
            const failed = page.waitForResponse(
              (response) =>
                response.url().endsWith("/api/v1/catalog") &&
                response.status() === 503,
            );
            await page.goto(`${fixture.origin}/lessons`, {
              waitUntil: "domcontentloaded",
            });
            await (await failed).finished();
            await settle(page, 400);
            const problems: string[] = [];
            const retry = page
              .locator("main.library-main")
              .getByRole("button", { name: "Try again", exact: true });
            const title = page.getByRole("heading", {
              name: "Lessons",
              exact: true,
              level: 1,
            });
            const titleBox = await title.boundingBox();
            const prefixed = await page.getByText(/\bError:/).count();
            if (prefixed)
              problems.push(`a message shows a raw “Error:” prefix`);
            if (!logged.some((text) => /catalog/i.test(text)))
              problems.push(
                `the catalog failure is not logged: ${JSON.stringify(logged)}`,
              );
            if (!(await retry.isVisible()))
              problems.push("Lessons offers no Try again after a failure");
            if (
              !(await page
                .locator("main.library-main [role=alert]")
                .filter({ hasText: /Lessons/ })
                .isVisible())
            )
              problems.push("Lessons does not say what failed, in place");
            // Any navigation re-runs the family load; it must not turn the
            // failure back into a wait that never ends.
            await navigateApp(page, "Practice");
            await page.waitForURL((url) => url.pathname === "/practice");
            await settle(page, 300);
            await navigateApp(page, "Lessons");
            await page.waitForURL((url) => url.pathname === "/lessons");
            await settle(page, 800);
            if (await page.locator('.library-main[aria-busy="true"]').count())
              problems.push(
                "after navigating, Lessons waits forever (aria-busy) on a failed catalog",
              );
            if (!(await retry.isVisible()))
              problems.push("after navigating, Lessons offers no Try again");
            // A retry that fails too says so, rather than looking unpressed.
            if (await retry.isVisible()) {
              await retry.click();
              await page
                .locator("main.library-main [role=alert]")
                .filter({ hasText: "Lessons still didn’t load." })
                .waitFor({ timeout: 5000 })
                .catch(() =>
                  problems.push("a failed Try again shows no sign that it ran"),
                );
            }
            if (problems.length) assert.deepEqual(problems, [], tag);
            allow = true;
            const seen = requests;
            await retry.click();
            await page
              .getByRole("searchbox", { name: "Search lessons" })
              .waitFor();
            await page
              .locator(".lesson-index [role=status]")
              .filter({ hasText: /[1-9]\d* lessons/ })
              .waitFor();
            await assertGroupedCatalog(page, tag);
            await settle(page, 150);
            assert.ok(
              requests > seen,
              `${tag}: Try again requests the catalog`,
            );
            assert.ok(
              sameBox(titleBox, await title.boundingBox()),
              `${tag}: the title moved when the retried catalog arrived`,
            );
            assert.equal(
              await page.locator("main.library-main [role=alert]").count(),
              0,
              `${tag}: the failure message clears once the catalog arrives`,
            );
            if (shots) await settle(page, 200);
          } else if (kind === "practice-title") {
            await page.goto(
              `${fixture.origin}/practice?skill=coordinate-polygons&template=coordinate-rectangle-measure`,
            );
            await page.locator("#problem-prompt").waitFor();
            await settle(page, 150);
            const title = page
              .locator(".workspace-topic-text")
              .filter({ visible: true });
            assert.equal(
              await title.evaluate((el) => {
                const range = document.createRange();
                range.selectNodeContents(el);
                const box = el
                  .closest(".workspace-topic")!
                  .getBoundingClientRect();
                return [...range.getClientRects()].every(
                  (r) =>
                    r.left >= box.left - 1 &&
                    r.right <= box.right + 1 &&
                    r.bottom <= box.bottom + 1,
                );
              }),
              true,
              `${tag}: the full practice title must be visible`,
            );
          } else if (kind === "progress-large-text") {
            await page.goto(`${fixture.origin}/progress`);
            await page.locator(".progress-skill-card").first().waitFor();
            await page.addStyleTag({
              content: "html { font-size: 200% !important; }",
            });
            await page.locator(".progress-workspace.large-text").waitFor();
            await settle(page, 200);
            for (const button of await page
              .locator(".progress-filters button")
              .all()) {
              assert.equal(
                await button.evaluate((el) => {
                  const box = el.getBoundingClientRect(),
                    range = document.createRange();
                  range.selectNodeContents(el);
                  return [...range.getClientRects()].every(
                    (r) =>
                      r.left >= box.left - 1 &&
                      r.right <= box.right + 1 &&
                      r.top >= box.top - 1 &&
                      r.bottom <= box.bottom + 1,
                  );
                }),
                true,
                `${tag}: enlarged filter label must fit its button`,
              );
            }
            const cards = await page.locator(".progress-cards").boundingBox();
            const pager = await page
              .locator(".progress-page-controls")
              .boundingBox();
            assert.ok(
              cards && pager && pager.y >= cards.y + cards.height - 1,
              `${tag}: pagination must follow the cards without overlap`,
            );
            const markers = await page
              .locator(".progress-observations > span")
              .all();
            assert.ok(
              markers.length > 0,
              `${tag}: recent answer marks are present`,
            );
            for (const marker of markers) {
              assert.equal(
                await marker.evaluate((el) => {
                  const box = el.getBoundingClientRect(),
                    range = document.createRange();
                  range.selectNodeContents(el);
                  return [...range.getClientRects()].every(
                    (r) =>
                      r.left >= box.left - 1 &&
                      r.right <= box.right + 1 &&
                      r.top >= box.top - 1 &&
                      r.bottom <= box.bottom + 1,
                  );
                }),
                true,
                `${tag}: enlarged answer marks must fit their circles`,
              );
            }
          } else {
            const library = kind === "library-loading";
            // Every idea practiced and due: a three-digit review count is the
            // widest label the filter row has to hold.
            const crowded = kind === "progress-filters";
            await page.route(
              library ? "**/api/v1/catalog" : "**/api/v1/learners/*/progress",
              async (route) => {
                await held;
                if (!crowded) return route.continue();
                const response = await route.fetch();
                const snapshot = await response.json();
                const practiced = snapshot.skills.find(
                  (skill: { attempts: number }) => skill.attempts > 0,
                );
                snapshot.skills = snapshot.skills.map(
                  (skill: { skillId: string }) => ({
                    ...practiced,
                    skillId: skill.skillId,
                    reviewDueAt: snapshot.asOf,
                  }),
                );
                await route.fulfill({ response, json: snapshot });
              },
            );
            await page.goto(
              `${fixture.origin}/${library ? "lessons" : "progress"}`,
              { waitUntil: "domcontentloaded" },
            );
            await page
              .getByRole("heading", {
                name: library ? "Lessons" : "Progress",
                exact: true,
              })
              .waitFor();
            await settle(page, 150);
            if (library) {
              assert.equal(
                await page
                  .getByText("0 lessons · 0 problem types", { exact: true })
                  .count(),
                0,
                `${tag}: unknown catalog is not empty`,
              );
              await page.locator('.library-main[aria-busy="true"]').waitFor();
              // The title paints at its final size and place, and the search
              // row and the count line hold theirs, before the catalog lands.
              const title = page.getByRole("heading", {
                name: "Lessons",
                exact: true,
                level: 1,
              });
              const before = {
                title: await title.boundingBox(),
                bar: await boxOf(
                  page,
                  'section.lesson-index [data-placeholder="search"]',
                ),
                line: await boxOf(page, "section.lesson-index [role=status]"),
              };
              release();
              await page
                .getByRole("searchbox", { name: "Search lessons" })
                .waitFor();
              await page
                .locator(".lesson-index [role=status]")
                .filter({ hasText: /[1-9]\d* lessons/ })
                .waitFor();
              await assertGroupedCatalog(page, tag);
              await settle(page, 150);
              const after = {
                title: await title.boundingBox(),
                bar: await page.getByRole("search").boundingBox(),
                line: await boxOf(page, "section.lesson-index [role=status]"),
              };
              const problems: string[] = [];
              if (!sameBox(before.title, after.title))
                problems.push(
                  `the title moved when the catalog arrived: ${JSON.stringify(before.title)} → ${JSON.stringify(after.title)}`,
                );
              if (!sameBox(before.bar, after.bar))
                problems.push(
                  `the search row was not reserved: ${JSON.stringify(before.bar)} → ${JSON.stringify(after.bar)}`,
                );
              if (!sameBox(before.line, after.line))
                problems.push(
                  `the count line moved: ${JSON.stringify(before.line)} → ${JSON.stringify(after.line)}`,
                );
              assert.deepEqual(problems, [], tag);
            } else {
              const geometry = () =>
                page.locator(".progress-controls").evaluate((root) =>
                  [root, ...root.querySelectorAll("button")].map((el) => {
                    const { x, y, width, height } = el.getBoundingClientRect();
                    return { x, y, width, height };
                  }),
                );
              const before = await geometry();
              release();
              await page.locator(".progress-skill-card").first().waitFor();
              await settle(page, 150);
              assert.deepEqual(
                await geometry(),
                before,
                `${tag}: controls moved after history arrived`,
              );
              // Each filter reads on one line, its count beside its label.
              assert.match(
                await page.locator(".progress-filters").innerText(),
                crowded ? /Review · \d{3}/ : /Review · \d+/,
                `${tag}: the fixture has ideas to review`,
              );
              assert.deepEqual(
                await wrappedLabels(page, ".progress-filters button"),
                [],
                `${tag}: a filter label wraps or leaves its button`,
              );
              await assertProgressPolish(page, tag);
            }
          }
          if (shots) {
            await settle(page, 350);
            await page.screenshot({
              path: `${shots}/${engine}-${kind}-${viewport.width}-${colorScheme}.png`,
            });
            if (kind === "progress-large-text") {
              await page
                .locator(".progress-page-controls")
                .scrollIntoViewIfNeeded();
              await settle(page, 150);
              await page.screenshot({
                path: `${shots}/${engine}-progress-large-text-pager-${viewport.width}-${colorScheme}.png`,
              });
            }
          }
          console.log(`${tag}: passed`);
        } catch (error) {
          console.error(tag, String(error));
          failures.push(`${tag}: ${String(error)}`);
        } finally {
          release();
          await context.unrouteAll({ behavior: "wait" });
          await context.close();
        }
      }
  assert.deepEqual(failures, [], failures.join("\n"));
}
