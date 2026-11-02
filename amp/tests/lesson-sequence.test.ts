import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferenceLesson } from "../src/content/ReferenceLesson";
import { ProblemLesson } from "../src/web/ProblemLesson";
import { fractionAdditionLesson } from "../src/content/fraction-addition-lesson";
import type { ProblemLessonView } from "../src/content/problem-lessons";

const stages = (html: string) =>
  [...html.matchAll(/data-lesson-stage="([^"]+)"/g)].map((match) => match[1]);
const sequence = ["intuition", "example", "method", "watch", "formal"];
test("reference lessons preserve content and put formal material after examples and pitfalls in web and print", () => {
  const lesson = structuredClone(fractionAdditionLesson);
  lesson.sections.push({
    stage: "formal",
    title: "An explicit condition",
    paragraphs: ["Use equal-sized wholes."],
    keepTogetherInPrint: true,
  });
  for (const print of [false, true]) {
    const html = renderToStaticMarkup(
      React.createElement(ReferenceLesson, { lesson, print }),
    );
    assert.deepEqual(stages(html), sequence);
    assert.ok(!html.includes('class="katex-error"'));
    for (const section of [...lesson.sections, ...lesson.closingSections!])
      assert.equal(
        html.split(`>${section.title}</h`).length - 1,
        1,
        section.title,
      );
    assert.ok(
      html.indexOf('data-lesson-stage="formal"') <
        html.indexOf("Use equal-sized wholes."),
    );
    if (print) assert.match(html, /class="keep-together"/);
  }
});

test("problem lessons teach an example before the procedure and keep definitions last", () => {
  const lesson: ProblemLessonView = {
    templateId: "sequence-fixture",
    title: "Joining groups",
    goal: "Find a total.",
    intuition: "Put the two groups together and count how many there are.",
    principle:
      "Addition gives the size of two disjoint finite collections together.",
    terms: [{ term: "Sum", meaning: "The result of addition." }],
    glossary: [],
    glossaryLexicon: {},
    method: ["Count the first group.", "Count on for the second group."],
    watch: "Count each object once.",
    example: {
      prompt: "Join 2 dots and 3 dots. How many?",
      steps: ["Start at 2 and count on 3 more: 3, 4, 5."],
      answer: "5",
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ProblemLesson, { lesson }),
  );
  assert.deepEqual(
    [...html.matchAll(/<h3>(.*?)<\/h3>/g)].map((match) => match[1]),
    ["Example", "Method", "Principle and definitions"],
  );
  assert.ok(html.includes(lesson.intuition!));
  assert.ok(html.indexOf(lesson.intuition!) < html.indexOf("<h3>Example"));
  assert.ok(
    html.indexOf('class="lesson-watch"') <
      html.indexOf('class="lesson-formal"'),
  );
  assert.ok(
    html.indexOf('class="lesson-formal"') <
      html.indexOf("The result of addition."),
  );
});
