import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
import { generateProblem } from "../src/math/engine";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (html: string) => {
    window: { document: Document; getComputedStyle: typeof getComputedStyle };
  };
};
test("workbooks and solutions reproduce the same twelve exercises without answer leakage", () => {
  for (const lesson of lessons) {
    const workbook = publicationHtml(lesson, "workbook"),
      solutions = publicationHtml(lesson, "solutions");
    const questions = (html: string) =>
      [...html.matchAll(/<h2>(\d+)\. ([\s\S]*?)<\/h2>/g)].map((m) => m[0]);
    assert.equal(questions(workbook).length, 12 * lesson.templateIds.length);
    assert.deepEqual(questions(workbook), questions(solutions));
    assert.ok(!workbook.includes("Answer:"));
    assert.ok(solutions.includes("Answer:"));
    assert.ok(workbook.includes("Edition 1"));
  }
});
test("publication content escapes source text rather than executing markup", () => {
  const lesson = { ...lessons[0], title: "<script>alert(1)</script>" };
  const html = publicationHtml(lesson, "lesson");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});
test("multi-select solutions review each printed statement once and retain its letter", () => {
  const plain = (element: Element) => {
    const copy = element.cloneNode(true) as Element;
    copy.querySelectorAll<HTMLElement>(".print-math[data-plain]").forEach((math) =>
      math.replaceWith(math.dataset.plain ?? ""),
    );
    return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
  };
  for (const [lessonId, familyId] of [
    ["quadrilateral-hierarchy", "quadrilateral-hierarchy-multiselect"],
    ["slope-triangle-statements", "slope-triangle-statements"],
  ]) {
    const bound = lessons.find((lesson) => lesson.id === lessonId);
    assert.ok(bound);
    const lesson = { ...bound, templateIds: [familyId] };
    const workbook = new JSDOM(publicationHtml(lesson, "workbook")).window.document;
    const solutions = new JSDOM(publicationHtml(lesson, "solutions")).window.document;
    const workItems = [...workbook.querySelectorAll(".exercise")];
    const solvedItems = [...solutions.querySelectorAll(".exercise")];
    assert.equal(workItems.length, 12);
    assert.equal(solvedItems.length, 12);
    for (let index = 0; index < 12; index++) {
      const problem = generateProblem(familyId, `print:${lessonId}:1:${index}`);
      assert.equal(problem.public.response.kind, "multi-select");
      if (problem.public.response.kind !== "multi-select") continue;
      const labels = problem.public.response.options.map((option) => option.label);
      assert.deepEqual(
        [...workItems[index]!.querySelectorAll(".print-choices > li")].map(plain),
        labels,
      );
      assert.equal(solvedItems[index]!.querySelector(".print-choices"), null);
      assert.ok(solvedItems[index]!.classList.contains("exercise--solutions"));
      const explanations = [
        ...solvedItems[index]!.querySelectorAll(":scope > ol[type='A'] > li"),
      ].map(plain);
      assert.equal(explanations.length, labels.length);
      for (let choice = 0; choice < labels.length; choice++)
        assert.ok(explanations[choice]!.startsWith(`“${labels[choice]}” `));
      assert.ok(plain(solvedItems[index]!).includes("Answer:"));
    }
  }
});

test("worked solution prompts keep structured tables and givens attached", () => {
  for (const lessonId of [
    "line-from-point-steps",
    "solve-justify-linear",
    "two-column-congruence-proof",
  ]) {
    const lesson = lessons.find((item) => item.id === lessonId);
    assert.ok(lesson);
    const { window } = new JSDOM(publicationHtml(lesson, "solutions"));
    const exercises = [...window.document.querySelectorAll(".exercise")];
    assert.equal(exercises.length, 12);
    const tables = window.document.querySelectorAll(".print-work");
    assert.ok(tables.length > 0, `${lessonId}: worked tables are present`);
    if (lessonId !== "line-from-point-steps")
      assert.ok(
        window.document.querySelectorAll(".print-work-start").length > 0,
      );
    for (const exercise of exercises) {
      assert.equal(window.getComputedStyle(exercise).breakInside, "auto");
      for (const part of exercise.querySelectorAll(
        ":scope > h2, :scope > .print-work, :scope > .print-work-start",
      )) {
        const style = window.getComputedStyle(part);
        assert.equal(
          style.breakInside,
          "avoid",
          `${lessonId}: ${part.className}`,
        );
        assert.equal(
          style.breakAfter,
          "avoid",
          `${lessonId}: ${part.className}`,
        );
      }
      assert.ok(exercise.querySelector(":scope > ol > li"));
      assert.match(exercise.lastElementChild?.textContent ?? "", /^Answer:/);
    }
  }
});
