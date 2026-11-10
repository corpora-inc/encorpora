import assert from "node:assert/strict";
import type { Page } from "playwright";
import { fillShapeStage } from "./ui-shape-composer";
import type { ShapeAnswer } from "../src/math/shape-composer";
import type { GeneratedProblem, PublicProblem } from "../src/math/contracts";
import {
  generateProblem,
  gradeAnswer,
  isValidResponse,
} from "../src/math/engine";
import { plotPoints, serializePlot } from "../src/math/point-plot";
import { fillCounterBuilder } from "./ui-counter-builder";
import {
  parseWorkDraft,
  rowShape,
  type WorkDraft,
} from "../src/math/structured-work";
import {
  cardRows,
  parseMultiPartDraft,
  serializeMultiPart,
} from "../src/math/multi-part-choice";
import {
  parseSelection,
  serializeSelection,
} from "../src/math/selection-response";

const servedProblems = new WeakMap<Page, Map<string, PublicProblem>>();
export function trackPracticeProblems(page: Page) {
  const served = new Map<string, PublicProblem>();
  servedProblems.set(page, served);
  page.on("response", async (response) => {
    if (!response.url().endsWith("/batches") || !response.ok()) return;
    try {
      const batch = await response.json();
      for (const problem of batch.problems ?? [])
        served.set(problem.id, problem);
    } catch (error) {
      // Closing a page or navigating away cancels a prefetched batch body.
      // A malformed successful response on an active page remains a failure.
      const gone =
        page.isClosed() ||
        !!response.request().failure() ||
        /navigated away|No resource with given identifier|Target page, context or browser has been closed/.test(
          String(error),
        );
      if (!gone) throw error;
    }
  });
  return served;
}

/** Prepares the actual rendered problem's controls. The caller owns the
 * response wait, including tests that deliberately lose an attempt response. */
export async function preparePracticeAnswer(
  page: Page,
  correct: boolean,
  savedFixture?: GeneratedProblem,
) {
  // Next can still be awaiting its prefetched problem after the click returns.
  await page.locator(".next-action").waitFor({ state: "hidden" });
  await page.locator(".problem-stage .question").waitFor();
  const compact = page.locator(".compact-answer-action");
  if (await compact.isVisible()) await compact.click();
  const template = await page
    .locator(".problem-content")
    .getAttribute("data-template");
  const served = servedProblems.get(page)!;
  const problemId = await page
    .locator(".problem-content")
    .getAttribute("data-problem-id");
  assert.ok(problemId, `${template}: visible problem ID`);
  const problem = served.get(problemId);
  assert.ok(problem, `missing served problem for ${template}/${problemId}`);
  const solution =
    savedFixture ?? generateProblem(problem.templateId, problem.seed);
  if (savedFixture) {
    assert.equal(savedFixture.public.id, problem.id, "Exact saved fixture ID");
    assert.equal(savedFixture.public.templateId, problem.templateId);
    assert.equal(savedFixture.public.seed, problem.seed);
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(solution.public.response)),
    problem.response,
    "Planned controls match the actual JSON response schema",
  );
  const schema = solution.public.response;
  if (process.env.LEVEL_DEBUG)
    console.log("Level answer", {
      template,
      seed: problem.seed,
      kind: schema.kind,
      correct,
    });
  const response = practiceResponse(solution, correct);
  const submit = async () => {
    if (schema.kind === "counter-builder") {
      await fillCounterBuilder(page, schema, response);
      await page.getByRole("button", { name: "Check", exact: true }).click();
      return;
    }
    if (schema.kind === "shape-composer") {
      const stages = JSON.parse(response) as ShapeAnswer;
      for (const [i, placements] of stages.entries()) {
        await fillShapeStage(page, placements);
        if (i < stages.length - 1)
          await page
            .getByRole("button", { name: "Join pieces", exact: true })
            .click();
      }
      await page.locator(".shape-answer .choice-submit").click();
    } else if (schema.kind === "structured-work") {
      const plan = parseWorkDraft(response)!;
      if (schema.mode === "order") {
        const order = schema.rows.map((row) => row.id);
        for (const [target, id] of (plan as string[]).entries()) {
          for (
            let position = order.indexOf(id);
            position > target;
            position--
          ) {
            await page
              .locator(`.work-row[data-row="${id}"]`)
              .getByRole("button", { name: /up$/ })
              .click();
            [order[position - 1], order[position]] = [
              order[position]!,
              order[position - 1]!,
            ];
          }
        }
      } else {
        for (const [index, values] of (plan as WorkDraft).entries()) {
          if (schema.open && index > 0)
            await page
              .getByRole("button", { name: "Add a step", exact: true })
              .click();
          const shape = rowShape(schema, index);
          for (const [fieldIndex, field] of shape.fields.entries()) {
            if (field.given !== undefined) continue;
            const cell = page
              .locator(".work-row")
              .nth(index)
              .locator(".work-cell")
              .nth(fieldIndex);
            if (field.kind === "choice") {
              const bank = schema.banks.find((bank) => bank.id === field.bank)!;
              await cell.locator(".work-choice").click();
              await page
                .locator('.work-menu [role="menuitemradio"]')
                .nth(
                  bank.options.findIndex(
                    (option) => option.id === values[fieldIndex],
                  ),
                )
                .click();
            } else {
              await cell.locator(".work-input").fill(values[fieldIndex]!);
            }
          }
          const done = page.locator('.work-keypad [data-key="done"]');
          if (await done.isVisible()) await done.click();
        }
      }
      await page.locator(".choice-submit:visible").click();
    } else if (schema.kind === "point-plot") {
      const layer = page.locator(".point-plot-layer");
      const grid = schema.grid;
      const origin = [
        Math.min(grid.xMax, Math.max(grid.xMin, 0)),
        Math.min(grid.yMax, Math.max(grid.yMin, 0)),
      ];
      for (const [x, y] of plotPoints(response)) {
        await layer.focus();
        await page.keyboard.press("Home");
        for (let step = 0; step < Math.abs(x - origin[0]!) / grid.step; step++)
          await page.keyboard.press(
            x < origin[0]! ? "ArrowLeft" : "ArrowRight",
          );
        for (let step = 0; step < Math.abs(y - origin[1]!) / grid.step; step++)
          await page.keyboard.press(y < origin[1]! ? "ArrowDown" : "ArrowUp");
        await page.keyboard.press("Enter");
      }
      await page.locator(".choice-submit:visible").click();
    } else if (schema.kind === "figure-choice") {
      await page
        .locator(".figure-choice-card")
        .nth(schema.options.findIndex((o) => o.id === response))
        .click();
      await page.locator(".choice-submit:visible").click();
    } else if (schema.kind === "multi-select") {
      for (const id of parseSelection(response)!)
        await page
          .locator(`.multi-select-form:visible input[value="${id}"]`)
          .check();
      await page.locator(".choice-submit:visible").click();
    } else if (schema.kind === "choice") {
      await page
        .locator(".choice-option:visible")
        .nth(schema.options.findIndex((o) => o.id === response))
        .click();
      await page.locator(".choice-submit:visible").click();
    } else if (schema.kind === "multi-part-choice") {
      const draft = parseMultiPartDraft(response)!;
      const rows = cardRows(schema);
      for (const blank of schema.blanks) {
        const option = draft[blank.id]!;
        if (schema.layout === "table") {
          await page
            .locator(
              `.multi-part tr[data-blank="${blank.id}"] input[value="${option}"]`,
            )
            .check();
        } else if (schema.layout === "cards") {
          await page
            .locator(`.multi-part-box[data-blank="${blank.id}"]`)
            .click();
          const row = rows.findIndex((r) => r.blanks.includes(blank));
          await page
            .locator(".multi-part-tray-row")
            .nth(row)
            .locator(".multi-part-card")
            .nth(rows[row]!.options.findIndex((o) => o.id === option))
            .click();
        } else {
          await page
            .locator(`.multi-part-blank[data-blank="${blank.id}"]`)
            .click();
          await page
            .locator('.multi-part-menu[data-state="open"]')
            .getByRole("menuitemradio")
            .nth(blank.options.findIndex((o) => o.id === option))
            .click();
        }
      }
      await page.locator(".choice-submit:visible").click();
    } else {
      assert.ok(
        schema.kind === "number" || schema.kind === "fraction",
        `${template}/${problem.seed}: unsupported UI response ${schema.kind}`,
      );
      const input = page.locator("#answer:visible");
      await input.fill(response);
      await input.press("Enter");
    }
  };
  return { problem, submit };
}

/** Answers the current problem through the visible controls. */
export async function answerOne(
  page: Page,
  correct: boolean,
  savedFixture?: GeneratedProblem,
) {
  const { problem, submit } = await preparePracticeAnswer(
    page,
    correct,
    savedFixture,
  );
  const template = problem.templateId;
  // Attach the response listener before submitting, and observe both promises
  // together so a control failure cannot leave an unhandled response timeout.
  const [outcome] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/attempts")),
    submit(),
  ]);
  assert.equal(outcome.status(), 200, await outcome.text());
  const result = await outcome.json();
  assert.equal(
    result.problemId,
    problem.id,
    `${template}/${problem.seed}: submitted the tracked problem`,
  );
  assert.equal(
    result.correct,
    correct,
    `${template}/${problem.seed}: actual attempt grading`,
  );
  servedProblems.get(page)!.delete(problem.id);
  await page.locator(".next-action").waitFor();
  return result;
}

export function practiceResponse(solution: GeneratedProblem, correct: boolean) {
  const problem = solution.public;
  const template = problem.templateId;
  const schema = problem.response;
  let response = solution.answer;
  if (!correct) {
    if (schema.kind === "counter-builder") {
      const answer = JSON.parse(response);
      answer.sentence[3] = (answer.sentence[3] + 1) % 11;
      return JSON.stringify(answer);
    }
    if (schema.kind === "shape-composer") {
      const stages = JSON.parse(response) as ShapeAnswer;
      stages.at(-1)!.pop();
      response = JSON.stringify(stages);
    } else if (schema.kind === "choice" || schema.kind === "figure-choice")
      response = schema.options.find((o) => o.id !== solution.answer)!.id;
    else if (schema.kind === "multi-select") {
      const ids = parseSelection(solution.answer)!;
      const replacement = schema.options.find((o) => !ids.includes(o.id))?.id;
      response = serializeSelection(
        replacement ? [...ids.slice(1), replacement] : ids.slice(1),
      );
    } else if (schema.kind === "point-plot") {
      const points = plotPoints(response);
      const grid = schema.grid;
      search: for (let x = grid.xMin; x <= grid.xMax; x += grid.step)
        for (let y = grid.yMin; y <= grid.yMax; y += grid.step) {
          if (points.slice(1).some((p) => p[0] === x && p[1] === y)) continue;
          const candidate = serializePlot(
            [[x, y], ...points.slice(1)],
            schema.ordered,
          );
          if (!gradeAnswer(solution, candidate)) {
            response = candidate;
            break search;
          }
        }
    } else if (schema.kind === "structured-work") {
      const draft = parseWorkDraft(response)!;
      const candidates: string[] = [];
      if (schema.mode === "order") {
        for (let i = 0; i < draft.length; i++)
          for (let j = i + 1; j < draft.length; j++) {
            const swapped = [...draft] as string[];
            [swapped[i], swapped[j]] = [swapped[j]!, swapped[i]!];
            candidates.push(JSON.stringify(swapped));
          }
      } else {
        for (const [i, row] of (draft as WorkDraft).entries())
          for (const [j, field] of rowShape(schema, i).fields.entries()) {
            if (field.given !== undefined) continue;
            const value = row[j]!;
            const alternatives =
              field.kind === "choice"
                ? schema.banks
                    .find((bank) => bank.id === field.bank)!
                    .options.map((option) => option.id)
                : [
                    value.replace(/\d/, (digit) =>
                      String((Number(digit) + 1) % 10),
                    ),
                    value + "+1",
                    "0",
                    "1",
                    "-1",
                  ];
            for (const alternative of alternatives) {
              const changed = (draft as WorkDraft).map((row) => [...row]);
              changed[i]![j] = alternative;
              candidates.push(JSON.stringify(changed));
            }
          }
      }
      response =
        candidates.find(
          (candidate) =>
            isValidResponse(problem, candidate) &&
            !gradeAnswer(solution, candidate),
        ) ?? response;
    } else if (schema.kind === "multi-part-choice") {
      const draft = parseMultiPartDraft(response)!;
      const blank = schema.blanks[0]!;
      const previous = draft[blank.id]!;
      const replacement = blank.options.find((o) => o.id !== previous)!.id;
      if (schema.layout === "cards" && !schema.reuse) {
        const row = cardRows(schema).find((r) => r.blanks.includes(blank))!;
        const occupied = row.blanks.find((b) => draft[b.id] === replacement);
        if (occupied) draft[occupied.id] = previous;
      }
      draft[blank.id] = replacement;
      response = serializeMultiPart(schema, draft);
    } else {
      // Preserve the family's response syntax (e.g. ordered pairs). A generic
      // "999999" can fail input validation and never submit an attempt.
      for (let i = 0; i < 20; i++) {
        const candidate = generateProblem(
          problem.templateId,
          `${problem.seed}:miss:${i}`,
        ).answer;
        if (
          isValidResponse(problem, candidate) &&
          !gradeAnswer(solution, candidate)
        ) {
          response = candidate;
          break;
        }
      }
      assert.ok(
        !gradeAnswer(solution, response),
        `no valid wrong response for ${template}`,
      );
    }
  }
  assert.ok(
    isValidResponse(problem, response),
    `${template}/${problem.seed}: planned response must be submittable`,
  );
  assert.equal(
    gradeAnswer(solution, response),
    correct,
    `${template}: planned answer`,
  );
  return response;
}
