import assert from "node:assert/strict";
import type { Browser } from "playwright";
import type { startShellFixture } from "./app-shell-fixture";
import { settle } from "./app-shell-probe";

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
        "trial-refresh",
        "trial-return",
        "trial-retry",
        "library-search",
        "practice-title",
        "library-loading",
        "progress-loading",
        "progress-large-text",
      ] as const) {
        if (
          only === "review-edges"
            ? !["library-search", "progress-large-text"].includes(kind)
            : only && only !== kind
        )
          continue;
        const context = await fixture.context(
          browser,
          kind.startsWith("trial") ? "trial" : "paid",
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
          if (kind === "trial-refresh") {
            await page.goto(`${fixture.origin}/try/map`);
            const map = page.locator(".frontier-map");
            await map.waitFor();
            const before = await map.boundingBox();
            await page.route("**/trial-progress", (route) =>
              route.fulfill({
                status: 503,
                json: { error: "Temporarily unavailable" },
              }),
            );
            const failedRefresh = page.waitForResponse(
              (response) =>
                response.url().endsWith("/trial-progress") &&
                response.status() === 503,
            );
            await page.evaluate(() =>
              window.dispatchEvent(new Event("visibilitychange")),
            );
            await (await failedRefresh).finished();
            await settle(page, 200);
            assert.equal(
              await map.count(),
              1,
              `${tag}: a failed refresh must retain the map`,
            );
            assert.deepEqual(
              await map.boundingBox(),
              before,
              `${tag}: the map must not move`,
            );
            await page
              .getByRole("alert")
              .filter({ hasText: /refresh|connection/i })
              .waitFor();
          } else if (kind === "trial-return" || kind === "trial-retry") {
            await page.goto(`${fixture.origin}/try/map`);
            await page.locator(".frontier-map").waitFor();
            await page
              .getByRole("link", { name: "Practice", exact: true })
              .click();
            await page.getByRole("button", { name: /^Skip/ }).waitFor();
            let failArrival = kind === "trial-retry";
            await page.route("**/trial-progress", async (route) => {
              await held;
              if (failArrival)
                await route.fulfill({
                  status: 503,
                  json: { error: "Temporarily unavailable" },
                });
              else await route.continue();
            });
            // A real skip invalidates the previously visited map. Opening its
            // drawer link must wait even while the router retains that route.
            await page.getByRole("button", { name: /^Skip/ }).click();
            await page.getByRole("button", { name: /^Next/ }).waitFor();
            await page.getByRole("button", { name: "Open AMP menu" }).click();
            await page
              .getByRole("link", { name: "Progress", exact: true })
              .click({ noWaitAfter: true });
            await settle(page, 350);
            assert.equal(
              await page.locator(".frontier-map").count(),
              0,
              `${tag}: invalidated map must not paint`,
            );
            release();
            await page.waitForURL("**/try/map");
            if (failArrival) {
              await page
                .getByRole("heading", { name: "Free practice didn’t load" })
                .waitFor();
              await settle(page, 300);
              assert.equal(
                await page.locator(".frontier-map").count(),
                0,
                `${tag}: failed arrival requires explicit retry`,
              );
              failArrival = false;
              await page
                .getByRole("button", { name: "Try again", exact: true })
                .click();
            }
            await page.locator(".frontier-map").waitFor();
          } else if (kind === "library-search") {
            await page.goto(`${fixture.origin}/lessons`);
            const field = page.getByRole("searchbox", {
              name: "Search lessons",
            });
            await field.waitFor();
            await page.locator("[data-lesson-id]").first().waitFor();
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
              if (shots && value === "zzzxq-nothing")
                await page.screenshot({
                  path: `${shots}/${engine}-library-empty-${viewport.width}-${colorScheme}.png`,
                });
            }
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
            await page.route(
              library ? "**/api/v1/catalog" : "**/api/v1/learners/*/progress",
              async (route) => {
                await held;
                await route.continue();
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
              release();
              await page
                .getByRole("searchbox", { name: "Search lessons" })
                .waitFor();
              await page
                .locator(".lesson-index [role=status]")
                .filter({ hasText: /[1-9]\d* lessons/ })
                .waitFor();
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
