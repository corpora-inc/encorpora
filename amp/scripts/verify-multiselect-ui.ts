import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem } from "../src/math/engine";
import {
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { assertOpaqueFeedback } from "./feedback-opacity-proof";
import { choose } from "./ui-controls";
import { startTopic } from "./ui-practice";

const database = process.env.AMP_TEST_DATABASE_URL;
if (!database) throw new Error("AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(database);
const templateId = "quadrilateral-hierarchy-multiselect";
const origin = "http://127.0.0.1:4420";
await migrate(database);
const repository = new PostgresRepository(database, {
  development: true,
  freeProblems: 100,
});
const learner = await repository.create(
  "development-household",
  "Selection reviewer",
  2015,
);
const sixOption = Array.from({ length: 64 }, (_, index) =>
  generateProblem(templateId, `${learner.id}:six-option-phone:${index}`),
).find(
  (problem) =>
    problem.public.response.kind === "multi-select" &&
    problem.public.response.options.length === 6,
);
assert.ok(sixOption, "The family offers a six-statement variant");
await repository.transaction("development-household", learner.id, (tx) =>
  tx.saveProblem(sixOption),
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
await app.listen({ host: "127.0.0.1", port: 4421 });
const vite = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4420,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4421" } },
  },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
const shots = new URL(
  `../artifacts/multiselect-ui-${process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium"}/`,
  import.meta.url,
).pathname;
await mkdir(shots, { recursive: true });
const errors: string[] = [];
let trialLearner: string | null = null;

async function openAnswers(page: Page, count: number) {
  const form = page.locator(".multi-select-form:visible");
  if (await form.isVisible()) return form;
  const opener = page.getByRole("button", {
    name: new RegExp(
      `Select ${count} statements|Review \\d of ${count} selected`,
    ),
  });
  await opener.waitFor({ state: "visible" });
  await opener.click();
  await form.waitFor();
  return form;
}

try {
  for (const theme of ["light", "dark"] as const)
    for (const [width, height] of [
      [320, 568],
      [390, 844],
      [768, 1024],
      [1280, 800],
    ]) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
        hasTouch: width <= 390,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      await choose(
        page.getByRole("button", { name: "Learner", exact: true }),
        learner.id,
      );
      if (width === 320 && theme === "light")
        await page.route(
          `**/api/v1/learners/${learner.id}/batches`,
          (route) => {
            const request = route.request();
            if (
              request.method() !== "POST" ||
              request.postDataJSON()?.templateId !== templateId
            )
              return route.continue();
            return route.fulfill({
              json: {
                problems: [sixOption.public],
                hints: { [sixOption.public.id]: { hint: sixOption.hint } },
                selection: [
                  {
                    problemId: sixOption.public.id,
                    reason: "focus",
                    strand: "geometry",
                  },
                ],
                lesson: null,
              },
            });
          },
        );
      const batch = page.waitForResponse(
        (response) =>
          response.url().endsWith("/batches") &&
          response.request().method() === "POST" &&
          response.request().postDataJSON()?.templateId === templateId,
      );
      await startTopic(page, templateId);
      const issued = await batch;
      assert.equal(issued.status(), 200);
      assert.ok(
        issued
          .request()
          .postDataJSON()
          .responseCapabilities.includes("multi-select-v1"),
      );
      const problem = (await issued.json()).problems[0];
      assert.equal(problem.templateId, templateId);
      assert.equal(problem.response.kind, "multi-select");
      const count = problem.response.selectionCount as number;
      assert.equal(count, 3, "This family selects three true statements");
      assert.ok([5, 6].includes(problem.response.options.length));
      if (width === 320 && theme === "light")
        assert.equal(problem.response.options.length, 6);
      const answer = parseSelection(
        generateProblem(templateId, problem.seed).answer,
      );
      assert.ok(answer && answer.length === count);
      const options = problem.response.options as {
        id: string;
        label: string;
      }[];
      const firstThree = options.slice(0, count).map((option) => option.id);
      const wrong =
        serializeSelection(firstThree) === serializeSelection(answer)
          ? [...firstThree.slice(0, -1), options[count]!.id]
          : firstThree;

      let form = await openAnswers(page, count);
      const checkboxes = form.getByRole("checkbox");
      assert.equal(await checkboxes.count(), options.length);
      assert.ok(await form.getByRole("button", { name: "Check" }).isDisabled());
      assert.match(
        (await form.textContent()) ?? "",
        new RegExp(`0 of ${count} selected`),
      );
      await checkboxes.first().focus();
      await page.keyboard.press("Space");
      assert.ok(
        await checkboxes.first().isChecked(),
        "Space toggles a checkbox",
      );
      assert.match(
        (await form.textContent()) ?? "",
        new RegExp(`1 of ${count} selected`),
      );
      assert.ok(await form.getByRole("button", { name: "Check" }).isDisabled());
      if (await page.locator(".choice-entry-dialog[open]").count())
        await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Hint", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("heading", { name: "Hint" })
        .waitFor();
      await page.keyboard.press("Escape");
      form = await openAnswers(page, count);
      assert.ok(await form.getByRole("checkbox").first().isChecked());
      assert.match(
        (await form.textContent()) ?? "",
        new RegExp(`1 of ${count} selected`),
      );
      if (width === 320 && theme === "light") {
        await page.keyboard.press("Escape");
        await page.getByRole("button", { name: "Lesson", exact: true }).click();
        const lesson = page.getByRole("dialog");
        const exampleChoices = lesson.getByRole("list", {
          name: "Example choices",
        });
        await exampleChoices.waitFor();
        const lessonChoiceCount = await exampleChoices
          .getByRole("listitem")
          .count();
        assert.ok(
          lessonChoiceCount === 5 || lessonChoiceCount === 6,
          `Worked example has ${lessonChoiceCount} statements`,
        );
        const lessonChoiceText = (await exampleChoices.textContent()) ?? "";
        assert.ok(
          !lessonChoiceText.includes("option-") &&
            !lessonChoiceText.includes('["'),
          "Worked example shows statement labels, not response IDs",
        );
        await exampleChoices.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${shots}/320-light-lesson.png` });
        await lesson
          .getByRole("button", { name: "Back to the problem" })
          .click();
        form = await openAnswers(page, count);
        assert.ok(await form.getByRole("checkbox").first().isChecked());
        assert.match(
          (await form.textContent()) ?? "",
          new RegExp(`1 of ${count} selected`),
        );
      }
      await form.getByRole("checkbox").first().focus();
      await page.keyboard.press("Space");
      assert.ok(!(await form.getByRole("checkbox").first().isChecked()));
      if (width === 320 && theme === "light") {
        const last = form.getByRole("checkbox").last();
        await last.check();
        const box = await last.boundingBox();
        await page.screenshot({ path: `${shots}/320-light-last-option.png` });
        assert.ok(
          box && box.y >= 0 && box.y + box.height <= height,
          `The sixth phone option is reachable within the list: ${JSON.stringify(box)}`,
        );
        await last.uncheck();
      }
      for (const [index, id] of [...wrong].reverse().entries()) {
        await form.locator(`input[type="checkbox"][value="${id}"]`).check();
        assert.match(
          (await form.textContent()) ?? "",
          new RegExp(`${index + 1} of ${count} selected`),
        );
        assert.equal(
          await form.getByRole("button", { name: "Check" }).isEnabled(),
          index === count - 1,
        );
      }
      for (const [index, option] of (
        await form.locator(".choice-option").all()
      ).entries()) {
        await option.scrollIntoViewIfNeeded();
        const bounds = await option.evaluate((row) => {
          const label = row.lastElementChild;
          const scroller = row.parentElement;
          if (!(label instanceof HTMLElement) || !scroller)
            throw new Error("Choice text or scroller is missing");
          const rowBox = row.getBoundingClientRect();
          const textBox = label.getBoundingClientRect();
          const scrollBox = scroller.getBoundingClientRect();
          const style = getComputedStyle(row);
          return {
            topInset:
              textBox.top -
              rowBox.top -
              parseFloat(style.borderTopWidth) -
              parseFloat(style.paddingTop),
            bottomInset:
              rowBox.bottom -
              textBox.bottom -
              parseFloat(style.borderBottomWidth) -
              parseFloat(style.paddingBottom),
            rowTop: rowBox.top,
            rowBottom: rowBox.bottom,
            scrollTop: scrollBox.top,
            scrollBottom: scrollBox.bottom,
          };
        });
        assert.ok(
          bounds.topInset >= -1 && bounds.bottomInset >= -1,
          `${width}px ${theme} option ${index + 1} text fits inside its padded row: ${JSON.stringify(bounds)}`,
        );
        assert.ok(
          bounds.rowTop >= bounds.scrollTop - 1 &&
            bounds.rowBottom <= bounds.scrollBottom + 1,
          `${width}px ${theme} option ${index + 1} is reachable in the scroller: ${JSON.stringify(bounds)}`,
        );
      }
      const geometry = await form.evaluate((node) => ({
        optionHeights: [
          ...node.querySelectorAll<HTMLElement>(".choice-option"),
        ].map((option) => option.getBoundingClientRect().height),
        submit: node
          .querySelector(".choice-submit")!
          .getBoundingClientRect()
          .toJSON(),
        overflow: document.documentElement.scrollWidth - innerWidth,
      }));
      await page.screenshot({
        path: `${shots}/${width}-${theme}-selected.png`,
      });
      assert.ok(geometry.optionHeights.every((size) => size >= 52));
      assert.ok(geometry.overflow <= 0, `${width}px horizontal overflow`);
      assert.ok(
        geometry.submit.top >= 0 && geometry.submit.bottom <= height + 1,
        `${width}px Check stays visible: ${JSON.stringify(geometry)}`,
      );
      const sent = page.waitForRequest(
        (request) =>
          request.url().endsWith("/attempts") && request.method() === "POST",
      );
      await form.getByRole("button", { name: "Check" }).click();
      const payload = (await sent).postDataJSON();
      assert.equal(payload.response, serializeSelection(wrong));
      await page.locator(".feedback.incorrect").waitFor();
      if (width === 320)
        await assertOpaqueFeedback(
          page,
          "incorrect",
          `${process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium"}-${width}-${theme}-multiselect-incorrect`,
        );
      const panel = (await page.locator(".solution-panel").textContent()) ?? "";
      assert.match(panel, /You selected/);
      assert.ok(!panel.includes("option-") && !panel.includes('["'));
      assert.ok(!panel.includes(".;"), "Sentence labels have clean separators");
      const answerCopy =
        (await page.locator(".solution-answer").getAttribute("data-text")) ??
        "";
      for (const id of answer) {
        const label = options.find((option) => option.id === id)!.label;
        assert.ok(answerCopy.includes(label), `Feedback names ${id}`);
      }
      if (width === 320) {
        const correctProblem = generateProblem(
          templateId,
          `${learner.id}:${theme}:feedback-correct`,
        );
        const skippedProblem = generateProblem(
          templateId,
          `${learner.id}:${theme}:feedback-skipped`,
        );
        assert.equal(correctProblem.public.response.kind, "multi-select");
        await repository.transaction(
          "development-household",
          learner.id,
          async (tx) => {
            await tx.saveProblem(correctProblem);
            await tx.saveProblem(skippedProblem);
          },
        );
        let nextProblem = correctProblem;
        await page.route(
          `**/api/v1/learners/${learner.id}/batches`,
          (route) => {
            const request = route.request();
            if (
              request.method() !== "POST" ||
              request.postDataJSON()?.templateId !== templateId
            )
              return route.continue();
            return route.fulfill({
              json: {
                problems: [nextProblem.public],
                hints: {
                  [nextProblem.public.id]: { hint: nextProblem.hint },
                },
                selection: [
                  {
                    problemId: nextProblem.public.id,
                    reason: "focus",
                    strand: "geometry",
                  },
                ],
                lesson: null,
              },
            });
          },
        );
        const correctBatch = page.waitForResponse(
          (response) =>
            response.url().endsWith("/batches") &&
            response.request().postDataJSON()?.templateId === templateId,
        );
        await startTopic(page, templateId);
        const correctIssued = await correctBatch;
        assert.equal(
          (await correctIssued.json()).problems[0]?.id,
          correctProblem.public.id,
        );
        form = await openAnswers(
          page,
          correctProblem.public.response.selectionCount,
        );
        const correctIds = parseSelection(correctProblem.answer);
        assert.ok(correctIds);
        for (const id of correctIds)
          await form.locator(`input[type="checkbox"][value="${id}"]`).check();
        await form.getByRole("button", { name: "Check" }).click();
        await page.locator(".feedback.correct").waitFor();
        await assertOpaqueFeedback(
          page,
          "correct",
          `${process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium"}-${width}-${theme}-multiselect-correct`,
        );

        nextProblem = skippedProblem;
        const skippedBatch = page.waitForResponse(
          (response) =>
            response.url().endsWith("/batches") &&
            response.request().postDataJSON()?.templateId === templateId,
        );
        await startTopic(page, templateId);
        assert.equal(
          (await (await skippedBatch).json()).problems[0]?.id,
          skippedProblem.public.id,
        );
        await page
          .getByRole("button", { name: "Skip this problem and see its answer" })
          .click();
        await page.locator(".feedback.skipped").waitFor();
        await assertOpaqueFeedback(
          page,
          "skipped",
          `${process.env.AMP_BROWSER === "webkit" ? "webkit" : "chromium"}-${width}-${theme}-multiselect-skipped`,
        );
      }
      assert.deepEqual(errors, [], `${width}px ${theme} page errors`);
      await context.close();
    }

  // A trial keeps an incomplete selection when the learner checks the map.
  const trial = await app.inject({
    method: "POST",
    url: "/api/v1/trials",
    payload: { birthYear: 2015 },
  });
  assert.equal(trial.statusCode, 201, trial.body);
  const { token, learnerId } = trial.json() as {
    token: string;
    learnerId: string;
  };
  trialLearner = learnerId;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(
    (value) => localStorage.setItem("amp.trial", value),
    token,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.on("pageerror", (error) => errors.push(error.message));
  const focused = page.waitForResponse(
    (response) =>
      response.url().endsWith("/batches") &&
      response.request().postDataJSON()?.templateId === templateId,
  );
  await page.goto(
    `${origin}/try/practice?skill=shape-hierarchy&template=${templateId}`,
  );
  const trialBatch = await focused;
  assert.ok(
    trialBatch
      .request()
      .postDataJSON()
      .responseCapabilities.includes("multi-select-v1"),
  );
  const trialProblem = (await trialBatch.json()).problems[0];
  assert.equal(trialProblem.templateId, templateId);
  await page.locator(`[data-template="${templateId}"]`).waitFor();
  const trialCount = trialProblem.response.selectionCount as number;
  let form = await openAnswers(page, trialCount);
  await form.getByRole("checkbox").first().check();
  assert.match(
    (await form.textContent()) ?? "",
    new RegExp(`1 of ${trialCount} selected`),
  );
  const prompt = await page.locator("#problem-prompt").textContent();
  await page.getByRole("link", { name: "Your level" }).click();
  await page.waitForURL("**/try/map");
  await page.goBack();
  await page.waitForURL(/\/try\/practice(?:\?|$)/);
  assert.equal(await page.locator("#problem-prompt").textContent(), prompt);
  form = await openAnswers(page, trialCount);
  assert.ok(await form.getByRole("checkbox").first().isChecked());
  assert.match(
    (await form.textContent()) ?? "",
    new RegExp(`1 of ${trialCount} selected`),
  );
  await page
    .getByRole("button", { name: "Skip this problem and see its answer" })
    .click();
  await page.locator(".feedback.skipped").waitFor();
  const skipAnswer =
    (await page.locator(".solution-answer").getAttribute("data-text")) ?? "";
  const trueIds = parseSelection(
    generateProblem(templateId, trialProblem.seed).answer,
  );
  assert.ok(trueIds && trueIds.length === trialCount);
  for (const id of trueIds) {
    const label = trialProblem.response.options.find(
      (option: { id: string; label: string }) => option.id === id,
    )?.label;
    assert.ok(label && skipAnswer.includes(label), `Skip explains ${id}`);
  }
  assert.ok(!skipAnswer.includes("option-") && !skipAnswer.includes('["'));
  await context.close();

  assert.deepEqual(errors, [], "No browser page errors");
  console.log(
    "Multi-select: exact-count checkbox, keyboard, hint, feedback, trial draft and skip passed at 320/390/768/1280 in both themes.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
    learner.id,
  ]);
  if (trialLearner)
    await repository.pool.query("DELETE FROM amp_learners WHERE id=$1", [
      trialLearner,
    ]);
  await repository.close();
}
