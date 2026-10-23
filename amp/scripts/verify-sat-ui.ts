import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { startTopic, exitPractice } from "./ui-practice";
import { choose } from "./ui-controls";
import {
  satCompletionTemplates,
  generateSatCompletionProblem,
} from "../src/math/sat-completion-practice";
import { satCompletionLessons } from "../src/content/sat-completion-lessons";
import { publicationHtml } from "../src/content/publications";

const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create(
  "development-household",
  "SAT example learner",
  2010,
);
const sibling = await repository.create(
  "development-household",
  "General example learner",
  2016,
);
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
app.get("/api/v1/auth-config", async () => ({ mode: "development" }));
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
const apiOrigin = await app.listen({ host: "127.0.0.1", port: 0 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 0,
    proxy: { "/api": { target: apiOrigin } },
  },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const output = "artifacts/sat-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
async function noOverflow(page: Page) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    "Horizontal overflow",
  );
}
async function family(page: Page) {
  await exitPractice(page);
  await page.getByRole("button", { name: "Family menu", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Manage family", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "SAT Math focus" }).waitFor();
}
try {
  for (const width of [320, 390, 768, 1280])
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width, height: width === 320 ? 568 : 900 },
        colorScheme: theme,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await repository.transaction(
        "development-household",
        learner.id,
        async (tx) => tx.setSatMathFocus(false),
      );
      await page.goto(`${origin}/family/learners`);
      await choose(
        page.getByRole("button", { name: "Family learner", exact: true }),
        learner.id,
      );
      await page.evaluate(
        (t) => document.documentElement.setAttribute("data-theme", t),
        theme,
      );
      const toggle = page.getByRole("checkbox", { name: "SAT Math focus" });
      await toggle.scrollIntoViewIfNeeded();
      const before = await toggle.boundingBox();
      assert(before && before.height >= 44);
      let release!: () => void;
      const delayed = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        "**/practice-settings",
        async (route) => {
          await delayed;
          await route.continue();
        },
        { times: 1 },
      );
      await toggle.click();
      await page.waitForFunction(() =>
        document.querySelector('[role="checkbox"]')?.hasAttribute("disabled"),
      );
      const during = await toggle.boundingBox();
      assert.equal(during?.y, before.y, "Saving moved the toggle");
      release();
      await page
        .getByText("Practice setting saved. It applies to the next problem.")
        .waitFor();
      assert.equal(await toggle.getAttribute("aria-checked"), "true");
      await noOverflow(page);
      await page.screenshot({
        path: `${output}/settings-${width}-${theme}.png`,
        fullPage: true,
      });
      await page.reload();
      assert.equal(await toggle.getAttribute("aria-checked"), "true");
      await choose(
        page.getByRole("button", { name: "Family learner", exact: true }),
        sibling.id,
      );
      assert.equal(await toggle.getAttribute("aria-checked"), "false");
      await choose(
        page.getByRole("button", { name: "Family learner", exact: true }),
        learner.id,
      );
      await page.route(
        "**/practice-settings",
        (route) =>
          route.fulfill({
            status: 503,
            contentType: "application/json",
            body: '{"error":"unavailable"}',
          }),
        { times: 1 },
      );
      await toggle.click();
      await page
        .getByText(
          "Could not confirm the practice setting. Refresh your family details and try again.",
        )
        .waitFor();
      assert.equal(await toggle.getAttribute("aria-checked"), "true");
      await noOverflow(page);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      // Representative symbolic, data, geometry and contextual tasks, all with
      // real client rendering and server-owned grading.
      const ids =
        width === 390 && theme === "light"
          ? satCompletionTemplates.map((t) => t.id)
          : [
              "nonlinear-data-model",
              "rational-function-representation",
              "quadratic-context-model",
              "unit-circle-coordinate",
            ];
      for (const id of ids) {
        await startTopic(page, id);
        await page.locator(".problem-stage").waitFor();
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        await noOverflow(page);
        assert.match(
          await page.locator(".workspace-topic").innerText(),
          /SAT Math/,
        );
        await page.screenshot({
          path: `${output}/${id}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      // Preserve an already served problem across a focus-setting change.
      const prompt = await page.locator(".problem-stage").innerText();
      await family(page);
      await toggle.click();
      await page
        .getByText("Practice setting saved. It applies to the next problem.")
        .waitFor();
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("button", { name: "Practice", exact: true }).click();
      const resume = page.getByRole("button", { name: /^(Go|Continue)$/ });
      if (await resume.isVisible()) await resume.click();
      assert.equal(await page.locator(".problem-stage").innerText(), prompt);
      assert.deepEqual(errors, []);
      await context.close();
    }
  // Shared print renderer, representative graph and inference lessons in both formats.
  const page = await browser.newPage();
  for (const id of [
    "rational-function-representation",
    "unit-circle-coordinate",
    "standard-deviation-compare",
    "compound-unit-conversion",
  ]) {
    const lesson = satCompletionLessons.find((l) => l.id === id)!;
    for (const format of ["Letter", "A4"] as const) {
      await page.setContent(publicationHtml(lesson, "lesson"));
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({
        path: `${output}/${id}-${format}.pdf`,
        format,
        printBackground: true,
      });
    }
  }
  await page.close();
  // Public cases for repeatable independent inspection, with no learner data.
  await writeFile(
    `${output}/cases.json`,
    JSON.stringify(
      satCompletionTemplates.map(
        (t) => generateSatCompletionProblem(t.id, "sat-visual").public,
      ),
      null,
      2,
    ),
  );
  console.log(
    "SAT settings, persistence, sibling isolation, loading/failure layout, active practice and content checked at 320/390/768/1280 in both themes.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [[learner.id, sibling.id]],
  );
  await repository.close();
}
