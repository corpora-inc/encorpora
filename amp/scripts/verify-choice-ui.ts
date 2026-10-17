import { startTopic } from "./ui-practice";
import { algebraTemplates } from "../src/math/algebra-practice.js";
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
import { choiceTemplates } from "../src/math/choice.js";
import type { PublicProblem } from "../src/math/contracts.js";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url) throw new Error("AMP_TEST_DATABASE_URL is required");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create(
  "development-household",
  "Interpretation explorer",
  2016,
);
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
await app.listen({ host: "127.0.0.1", port: 4391 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4390,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4391" } },
  },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch({ headless: true });
const directory = new URL(
  `../artifacts/choice-review-${process.platform}-${process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium"}/`,
  import.meta.url,
);
await mkdir(directory, { recursive: true });
try {
  const page = await browser.newPage({ hasTouch: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4390");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(size);
    for (const template of [
      ...choiceTemplates,
      ...algebraTemplates.filter(
        (t) => t.requiredResponseCapability === "single-choice-v1",
      ),
    ]) {
      const batchPromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/batches") &&
          response.request().method() === "POST" &&
          response.request().postDataJSON()?.templateId === template.id,
      );
      await startTopic(page, template.id);
      const batch = await (await batchPromise).json();
      const problem: PublicProblem = batch.problems[0];
      assert.equal(problem.templateId, template.id);
      if (problem.response.kind !== "choice")
        throw new Error("Missing choice response");
      const privateProblem = generateProblem(template.id, problem.seed);
      const wrong = problem.response.options.find(
        (option) => option.id !== privateProblem.answer,
      )!;
      const correct = problem.response.options.find(
        (option) => option.id === privateProblem.answer,
      )!;
      await page.locator(".problem-stage").waitFor();
      if (size.width === 320)
        await page
          .getByRole("button", { name: "Choose an answer", exact: true })
          .click();
      await page.getByRole("radio").first().waitFor();
      assert.equal(
        await page
          .getByRole("button", { name: "Keyboard", exact: true })
          .count(),
        0,
      );
      assert.equal(await page.locator(".math-keypad").count(), 0);
      await page.screenshot({
        path: new URL(`${template.id}-${size.width}.png`, directory).pathname,
      });
      assert.ok(
        await page.evaluate(() => {
          const box = document
            .querySelector(".choice-submit")!
            .getBoundingClientRect();
          const options = [...document.querySelectorAll(".choice-option")];
          const dialog = document.querySelector("dialog[open] .dialog-content");
          return (
            box.bottom <= innerHeight &&
            box.top >= 0 &&
            document.documentElement.scrollWidth <= innerWidth &&
            options.every((option) => {
              const b = option.getBoundingClientRect();
              return (
                b.top >= 0 &&
                b.bottom <= innerHeight &&
                b.width >= 44 &&
                b.height >= 44
              );
            }) &&
            (!dialog || dialog.scrollHeight <= dialog.clientHeight + 2)
          );
        }),
        `${template.id} choices and action must fit ${size.width}x${size.height}`,
      );
      for (const graph of await page.locator(".choice-coordinate").all()) {
        const issues = await graph.evaluate((svg) =>
          [...svg.querySelectorAll("text")].flatMap((text) => {
            const box = text.getBBox(),
              scale = text.getScreenCTM(),
              font = parseFloat(getComputedStyle(text).fontSize);
            const pixels = scale ? font * Math.hypot(scale.a, scale.b) : 0;
            return box.x >= -1 &&
              box.x + box.width <= 301 &&
              box.y >= -1 &&
              box.y + box.height <= 177 &&
              pixels >= 12
              ? []
              : [
                  {
                    text: text.textContent,
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    pixels,
                  },
                ];
          }),
        );
        assert.deepEqual(
          issues,
          [],
          `${template.id} coordinate labels must stay within the figure and render at least12px`,
        );
      }
      await page.getByRole("radio").first().focus();
      await page.keyboard.press("ArrowRight");
      assert.ok(
        await page.getByRole("radio").nth(1).isChecked(),
        "Native radio arrow selection",
      );
      await page.getByRole("radio", { name: wrong.label, exact: true }).check();
      await page.screenshot({
        path: new URL(`${template.id}-${size.width}.png`, directory).pathname,
      });
      const lostAcknowledgment =
        size.width === 390 && template.id === "fraction-equivalence-choice";
      const submissions: unknown[] = [];
      if (lostAcknowledgment)
        await page.route("**/attempts", async (route) => {
          submissions.push(route.request().postDataJSON());
          if (submissions.length === 1) {
            const saved = await route.fetch();
            assert.equal(saved.status(), 200);
            await route.fulfill({
              status: 503,
              json: { error: "Response interrupted after save" },
            });
          } else await route.continue();
        });
      await page.getByRole("button", { name: "Check", exact: true }).click();
      if (lostAcknowledgment) {
        await page
          .getByRole("button", { name: "Retry", exact: true })
          .waitFor();
        assert.ok(await page.getByRole("radio").first().isDisabled());
        await page.getByRole("button", { name: "Retry", exact: true }).click();
      }
      await page.locator(".feedback.incorrect").waitFor();
      if (lostAcknowledgment) {
        assert.equal(submissions.length, 2);
        assert.deepEqual(submissions[0], submissions[1]);
        await page.unroute("**/attempts");
      }
      assert.ok(
        (await page
          .locator(".solution-answer")
          .getAttribute("data-text"))!.includes(correct.label),
      );
      assert.ok(
        (await page.locator(".solution-panel").innerText()).includes(
          wrong.label,
        ),
      );
      assert.ok(
        !(await page.locator(".solution-panel").innerText()).includes(
          "option-",
        ),
      );
      assert.equal(
        await page
          .locator(".solution-panel li")
          .first()
          .getAttribute("data-text"),
        privateProblem.choiceFeedback![wrong.id],
      );
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
      const continueButton = page.getByRole("button", { name: /^Next/ });
      await continueButton.waitFor();
      assert.ok(
        await continueButton.evaluate(
          (button) => button === document.activeElement,
        ),
        `Closing feedback returns focus to Continue for ${template.id} at ${size.width}: ${await page.evaluate(() => document.activeElement?.outerHTML)}`,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "Choice radio, viewport, focused feedback and answer-label journeys passed at four sizes.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  await repository.close();
}
