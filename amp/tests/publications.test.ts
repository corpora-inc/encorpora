import { test } from "node:test";
import assert from "node:assert/strict";
import { publicationHtml } from "../src/content/publications";
import { lessons } from "../src/content/lessons";
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
