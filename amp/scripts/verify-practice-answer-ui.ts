import { secureChromium } from "../browser-security.mjs";
/** Real API/browser regression for every response shape used by journey tests. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
import { createServer } from "vite";
import { buildApp } from "../src/server/app";
import { developmentAuth } from "../src/server/auth";
import { PostgresRepository } from "../src/server/repository";
import { registerFamilyRoutes } from "../src/family/routes";
import { generateProblem, templates } from "../src/math/engine";
import { twoColumnProofCases } from "../src/math/two-column-proof-practice";
import type { GeneratedProblem, ProblemResponse } from "../src/math/contracts";
import { migrate } from "./migrate";
import { assertTestDatabaseTarget } from "./test-database-preflight";
import { answerOne, trackPracticeProblems } from "./ui-practice-answer";
import { chooseLearner } from "./ui-controls";
import { startTopic } from "./ui-practice";

const responseShape = (response: ProblemResponse) =>
  response.kind === "multi-part-choice"
    ? `${response.kind}/${response.layout}/${response.reuse ?? false}`
    : response.kind === "structured-work"
      ? `${response.kind}/${response.mode}/${response.layout}/${!!response.open}`
      : response.kind === "point-plot"
        ? `${response.kind}/${response.ordered}`
        : response.kind;

const url = process.env.AMP_TEST_DATABASE_URL;
assert.ok(url, "AMP_TEST_DATABASE_URL is required");
assertTestDatabaseTarget(url);
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const learner = await repository.create(
  "development-household",
  "Response controls",
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
await app.listen({ host: "127.0.0.1", port: 4955 });
const vite = await createServer({
  cacheDir: "node_modules/.vite-practice-answer",
  server: {
    watch: { ignored: ["**/artifacts/**"] },
    host: "127.0.0.1",
    port: 4954,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4955" } },
  },
});
await vite.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);
  const served = trackPracticeProblems(page);
  const kinds = new Set<string>();
  const representatives = new Map<string, GeneratedProblem>();
  for (const template of templates) {
    const problem = generateProblem(template.id, "response-controls");
    const response = problem.public.response;
    kinds.add(response.kind);
    const signature = responseShape(response);
    if (!representatives.has(signature))
      representatives.set(signature, problem);
  }
  // Ordering is a supported protocol exercised by the structured-work suite;
  // its controlled case supplements the default runtime generator shapes.
  const ordering = twoColumnProofCases["two-column-angle-proof"](
    "response-controls-order",
    {
      mode: "order",
      proof: "supplementary",
    },
  ).problem;
  representatives.set(responseShape(ordering.public.response), ordering);
  // Unequal menu lengths expose a closing menu being counted as part of
  // the next blank's options. This seed failed in the free-trial journey.
  const inline = generateProblem(
    "point-on-axis-sentence",
    "77e73c1e-b008-4c2a-9172-388b554e9c51",
  );
  representatives.set(responseShape(inline.public.response), inline);
  assert.deepEqual(
    [...kinds].sort(),
    [
      "number",
      "fraction",
      "choice",
      "multi-select",
      "point-plot",
      "counter-builder",
      "multi-part-choice",
      "figure-choice",
      "structured-work",
    ].sort(),
  );
  await page.goto("http://127.0.0.1:4954/overview");
  await chooseLearner(page, learner.id);
  // Keep exiting menus mounted long enough to exercise the overlap reliably.
  await page.addStyleTag({
    content: ".multi-part-menu { animation-duration: 800ms; }",
  });
  let repeatedTemplateDecoyId: string | undefined;
  for (const [signature, representative] of representatives) {
    const template = representative.public.templateId;
    await page.setViewportSize({
      width: representative === inline ? 384 : 390,
      height: representative === inline ? 688 : 844,
    });
    for (const correct of [true, false]) {
      console.log(
        `Response controls: ${signature}, ${template}, correct=${correct}`,
      );
      const problem = structuredClone(representative);
      problem.public.id = randomUUID();
      await repository.transaction("development-household", learner.id, (tx) =>
        tx.saveProblem(problem),
      );
      const batchProblems = [problem.public];
      if (signature === "number" && correct) {
        // Keep an unused prefetched problem with the same template and a
        // different seed. The next attempt must identify its rendered ID,
        // rather than selecting this older entry by template alone.
        const decoy = generateProblem(template, "response-controls-stale");
        decoy.public.id = randomUUID();
        repeatedTemplateDecoyId = decoy.public.id;
        await repository.transaction(
          "development-household",
          learner.id,
          (tx) => tx.saveProblem(decoy),
        );
        batchProblems.push(decoy.public);
      }
      const batches = `**/api/v1/learners/${learner.id}/batches`;
      await page.unroute(batches);
      await page.route(batches, (route) => {
        if (
          route.request().method() !== "POST" ||
          route.request().postDataJSON()?.templateId !== template
        )
          return route.continue();
        return route.fulfill({
          json: {
            problems: batchProblems,
            hints: { [problem.public.id]: { hint: problem.hint } },
            lesson: null,
          },
        });
      });
      await startTopic(page, template);
      await page.locator(".problem-stage .question").waitFor();
      const visibleId = await page
        .locator(".problem-content")
        .getAttribute("data-problem-id");
      const actual = served.get(visibleId!);
      assert.ok(actual, `${signature}: served problem exists`);
      assert.equal(
        actual.id,
        problem.public.id,
        "The exact saved fixture was served",
      );
      if (signature === "number" && !correct) {
        const older = served.get(repeatedTemplateDecoyId!);
        assert.ok(
          older,
          "An older same-template prefetched problem remains tracked",
        );
        assert.equal(older.templateId, actual.templateId);
        assert.notEqual(
          older.seed,
          actual.seed,
          "The regression includes distinct seeds",
        );
      }
      assert.equal(
        responseShape(actual.response),
        signature,
        "The actual served problem covers the selected response shape",
      );
      const outcome = await answerOne(page, correct, problem);
      assert.equal(
        outcome.correct,
        correct,
        `${signature}: actual API grading`,
      );
    }
  }
  console.log(
    `Response controls passed: ${representatives.size} shapes, correct and incorrect actual attempts.`,
  );
  // Exhaustive viewport sweeps use the supported lesson URL, while the
  // response-shape journeys above exercise the default library entry.
  const directTemplate = "complex-parts";
  const batches = `**/api/v1/learners/${learner.id}/batches`;
  await page.unroute(batches);
  await startTopic(page, directTemplate, { entry: "lesson-url" });
  const directOutcome = await answerOne(page, true);
  assert.equal(
    directOutcome.correct,
    true,
    "Direct lesson entry uses real API grading",
  );
  const beforeMalformed = page.url();
  await assert.rejects(
    startTopic(page, `${directTemplate}&topic=mean-data`, {
      entry: "lesson-url",
    }),
    /Invalid lesson template ID/,
  );
  assert.equal(
    page.url(),
    beforeMalformed,
    "Malformed IDs cannot change the route",
  );
  const lesson = `**/api/v1/problem-lessons/${directTemplate}`;
  await page.route(lesson, (route) =>
    route.fulfill({ json: { lesson: null } }),
  );
  await assert.rejects(
    startTopic(page, directTemplate, { entry: "lesson-url" }),
    /Malformed lesson response/,
  );
  await page.unroute(lesson);
  await page.route(lesson, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.lesson.templateId = "mean-data";
    await route.fulfill({ json: body });
  });
  await assert.rejects(
    startTopic(page, directTemplate, { entry: "lesson-url" }),
    /Lesson response template mismatch/,
  );
  await page.unroute(lesson);
  await page.route(batches, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const problem of body.problems) problem.templateId = "mean-data";
    await route.fulfill({ json: body });
  });
  await assert.rejects(
    startTopic(page, directTemplate, { entry: "lesson-url" }),
    /Practice response template mismatch/,
  );
  await page.unroute(batches);
  console.log(
    "Direct lesson entry passed: real answer, malformed ID/payload and wrong lesson/problem rejection.",
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
