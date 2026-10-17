import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app.js";
import { PostgresRepository } from "../src/server/repository.js";
import { developmentAuth } from "../src/server/auth.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { migrate } from "./migrate.js";
import { generateProblem } from "../src/math/engine.js";
import { seedProgress } from "../tests/progress.fixture.js";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL required");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await seedProgress(repository, "development-household"),
  fresh = await repository.create("development-household", "New explorer");
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4401 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4400,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4401" } },
  },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
const dir = new URL("../artifacts/progress-review/", import.meta.url);
await mkdir(dir, { recursive: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4400");
  for (const size of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("combobox", { name: "Learner", exact: true })
      .selectOption(fresh.id);
    await page
      .getByRole("button", { name: "Your progress", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Let curiosity lead", exact: true })
      .waitFor();
    await page.screenshot({
      path: new URL(`empty-${size.width}.png`, dir).pathname,
    });
    await page
      .getByRole("combobox", { name: "Learner", exact: true })
      .selectOption(learner.id);
    await page.locator(".progress-skill-card").first().waitFor();
    await page.waitForTimeout(100);
    await page.screenshot({
      path: new URL(`overview-${size.width}.png`, dir).pathname,
    });
    const layout = await page.evaluate(() => {
      const stage = document.querySelector(".progress-card-stage")!;
      const footer = document
        .querySelector(".progress-page-controls")!
        .getBoundingClientRect();
      return {
        scroll: stage.scrollHeight,
        height: stage.clientHeight,
        footerBottom: footer.bottom,
        body: document.documentElement.scrollWidth,
        width: innerWidth,
        heightWindow: innerHeight,
      };
    });
    assert.ok(
      layout.scroll <= layout.height + 2,
      `Overview scroll ${size.width}: ${JSON.stringify(layout)}`,
    );
    assert.ok(layout.footerBottom <= size.height && layout.body <= size.width);
    for (const name of ["Math area", "Learner"]) {
      const target = await page
        .getByRole("combobox", { name, exact: true })
        .boundingBox();
      assert.ok(target && target.height >= 44, `${name} needs a 44px target`);
    }
    await page
      .getByRole("combobox", { name: "Math area" })
      .selectOption("number");
    await page.locator('[data-progress-skill="count-to-20"]').click();
    await page.locator(".progress-detail-content").waitFor();
    await page.screenshot({
      path: new URL(`detail-${size.width}.png`, dir).pathname,
    });
    const detail = await page
      .locator(".progress-detail-content")
      .evaluate((e) => ({ scroll: e.scrollHeight, height: e.clientHeight }));
    assert.ok(
      detail.scroll <= detail.height + 2,
      `Detail scroll ${size.width}: ${JSON.stringify(detail)}`,
    );
    await page.getByRole("button", { name: "All ideas", exact: false }).click();
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("data-progress-skill") ===
        "count-to-20",
    );
    await page.getByRole("combobox", { name: "Math area" }).selectOption("");
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await page.locator(".progress-skill-card").first().waitFor();
    await page.screenshot({
      path: new URL(`explore-${size.width}.png`, dir).pathname,
    });
    for (const filterName of ["Explore", "Practiced", /^Review/]) {
      await page
        .getByRole("button", {
          name: filterName,
          exact: typeof filterName === "string",
        })
        .click();
      for (;;) {
        await page.waitForTimeout(30);
        const fits = await page
          .locator(".progress-card-stage")
          .evaluate((e) => e.scrollHeight <= e.clientHeight + 2);
        if (!fits)
          await page.screenshot({
            path: new URL(`overflow-${size.width}.png`, dir).pathname,
          });
        assert.ok(
          fits,
          `${String(filterName)} ${size.width}: ${await page.locator(".progress-page-controls").innerText()}`,
        );
        const cardIds = await page
          .locator(".progress-skill-card")
          .evaluateAll((elements) =>
            elements.map((e) => e.getAttribute("data-progress-skill")!),
          );
        for (const id of cardIds) {
          await page.locator(`[data-progress-skill="${id}"]`).click();
          const bounds = await page
            .locator(".progress-detail-content")
            .evaluate((e) => ({
              height: e.clientHeight,
              scroll: e.scrollHeight,
            }));
          if (bounds.scroll > bounds.height + 2)
            await page.screenshot({
              path: new URL(`detail-overflow-${size.width}-${id}.png`, dir)
                .pathname,
            });
          assert.ok(
            bounds.scroll <= bounds.height + 2,
            `${id} ${size.width} detail: ${JSON.stringify(bounds)}`,
          );
          await page.getByRole("button", { name: /All ideas/ }).click();
        }
        const next = page.getByRole("button", {
          name: "Next ideas",
          exact: true,
        });
        if (await next.isDisabled()) break;
        await next.click();
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Practiced", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Math area" })
    .selectOption("number");
  await page.locator('[data-progress-skill="count-to-20"]').click();
  await page.getByRole("button", { name: "About practice history" }).click();
  await page.getByRole("heading", { name: "Reading your practice" }).waitFor();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("aria-label") ===
      "About practice history",
  );
  await page
    .getByRole("button", { name: "Read the lesson", exact: true })
    .click();
  await page.getByRole("button", { name: "Your idea", exact: false }).click();
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("data-progress-lesson") ===
      "count-to-20",
  );
  const batchPromise = page.waitForResponse(
    (r) => r.url().endsWith("/batches") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Try one problem", exact: true })
    .click();
  const batch = await (await batchPromise).json();
  assert.equal(batch.problems.length, 1);
  const problem = batch.problems[0];
  assert.equal(problem.skillId, "count-to-20");
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Read the lesson", exact: true })
    .click();
  await page.getByRole("button", { name: "Your idea", exact: false }).click();
  await page
    .getByRole("button", { name: "Your practice", exact: true })
    .click();
  await page
    .locator("#answer")
    .fill(String(generateProblem(problem.templateId, problem.seed).answer));
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await page
    .locator(".answer-status")
    .filter({ hasText: "Practiced with support" })
    .waitFor();
  assert.match(
    await page.locator(".answer-status").innerText(),
    /Practiced with support/,
  );
  await page.keyboard.press("Escape");
  const mixPromise = page.waitForResponse(
    (r) => r.url().endsWith("/batches") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Continue/ }).click();
  const mixResponse = await mixPromise;
  assert.equal(mixResponse.request().postDataJSON().templateId, undefined);
  assert.equal((await mixResponse.json()).problems.length, 3);
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page
    .locator(".progress-counts strong")
    .first()
    .filter({ hasText: "6" })
    .waitFor();
  assert.equal(
    await page.locator(".progress-counts strong").nth(1).innerText(),
    "5",
  );

  await page.route("**/progress", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "History temporarily unavailable" },
    }),
  );
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "History temporarily unavailable" })
    .waitFor();
  assert.match(
    await page.getByRole("alert").innerText(),
    /Showing history from/,
  );
  await page.unroute("**/progress");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("alert").waitFor({ state: "hidden" });

  // A superseded failed refresh must not cover a newer successful snapshot.
  let releaseOld!: () => void, sawOld!: () => void;
  const oldWait = new Promise<void>((resolve) => (releaseOld = resolve));
  const oldStarted = new Promise<void>((resolve) => (sawOld = resolve));
  let refreshRequests = 0;
  await page.route("**/progress", async (route) => {
    if (++refreshRequests === 1) {
      sawOld();
      await oldWait;
      await route.fulfill({
        status: 503,
        json: { error: "Superseded refresh" },
      });
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await oldStarted;
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await page.locator('.progress-workspace[aria-busy="false"]').waitFor();
  releaseOld();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await page.getByRole("alert").count(), 0);

  // A failed request for a view the learner has left cannot paint an unrelated error.
  let releaseBatch!: () => void, sawBatch!: () => void;
  const batchWait = new Promise<void>((resolve) => (releaseBatch = resolve));
  const batchStarted = new Promise<void>((resolve) => (sawBatch = resolve));
  await page.route("**/batches", async (route) => {
    sawBatch();
    await batchWait;
    await route.fulfill({
      status: 503,
      json: { error: "Obsolete practice request" },
    });
  });
  await page
    .getByRole("button", { name: "Try one problem", exact: true })
    .click();
  await batchStarted;
  await page
    .getByRole("button", { name: "Lesson library", exact: true })
    .click();
  releaseBatch();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.locator(".progress-workspace").count(), 0);
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();

  // Returning after an orientation change retains the selected card and keyboard focus.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole("button", { name: /All ideas/ }).click();
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("data-progress-skill") ===
      "count-to-20",
  );
  await page
    .getByRole("combobox", { name: "Math area" })
    .selectOption("fractions");
  await page.locator('[data-progress-skill="fraction-equivalence"]').click();
  await page
    .getByRole("button", { name: "Open related book", exact: true })
    .click();
  await page.getByRole("button", { name: "← Back", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.activeElement?.getAttribute("data-book-id") ===
      "fraction-field-guide",
  );

  // An old learner's completed response cannot repaint a newly selected learner.
  let release!: () => void, captured!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (captured = resolve));
  await page.route(`**/learners/${learner.id}/progress`, async (route) => {
    const response = await route.fetch();
    captured();
    await held;
    await route.fulfill({ response });
  });
  await page
    .getByRole("button", { name: "Your progress", exact: true })
    .click();
  await started;
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(fresh.id);
  await page
    .getByRole("heading", { name: "Let curiosity lead", exact: true })
    .waitFor();
  release();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(await page.locator(".progress-skill-card").count(), 0);

  // Text enlargement preserves access to every action without horizontal clipping.
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .getByRole("combobox", { name: "Math area" })
    .selectOption("number");
  await page.locator('[data-progress-skill="count-to-20"]').click();
  await page.getByRole("button", { name: "About practice history" }).click();
  await page
    .getByRole("button", { name: "Back to your idea", exact: true })
    .click();
  await page.screenshot({ path: new URL("large-text-320.png", dir).pathname });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(
    await page
      .getByRole("button", { name: "Try one problem", exact: true })
      .isVisible(),
  );
  const largeAction = page.getByRole("button", {
    name: "Try one problem",
    exact: true,
  });
  await largeAction.scrollIntoViewIfNeeded();
  assert.ok(
    await largeAction.evaluate((e) => {
      const r = e.getBoundingClientRect();
      return (
        r.left >= 0 &&
        r.right <= innerWidth &&
        r.top >= 0 &&
        r.bottom <= innerHeight
      );
    }),
  );
  await page.screenshot({
    path: new URL("large-text-actions-320.png", dir).pathname,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Progress fits four sizes; lesson assistance, mixed continuation, book return, retry, stale responses, focus and enlarged text passed.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [[learner.id, fresh.id]],
  );
  await repository.close();
}
