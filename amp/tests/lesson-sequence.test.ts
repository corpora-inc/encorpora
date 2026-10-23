import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { ReferenceLesson } from "../src/content/ReferenceLesson";
import { ProblemLesson } from "../src/web/ProblemLesson";
import { fractionAdditionLesson } from "../src/content/fraction-addition-lesson";
import type { ProblemLessonView } from "../src/content/problem-lessons";

test("reference lessons preserve content and put formal material after the example, method and pitfalls", () => {
  const lesson = structuredClone(fractionAdditionLesson);
  lesson.sections.push({
    stage: "formal",
    title: "An explicit condition",
    paragraphs: ["Use equal-sized wholes."],
  });
  const html = renderToStaticMarkup(
    React.createElement(ReferenceLesson, { lesson }),
  );
  const doc = new JSDOM(html).window.document;
  assert.deepEqual(
    [...doc.querySelectorAll("[data-lesson-stage]")].map((el) =>
      el.getAttribute("data-lesson-stage"),
    ),
    ["intuition", "example", "method", "watch", "formal"],
  );
  assert.equal(doc.querySelectorAll(".katex-error").length, 0);
  for (const section of [...lesson.sections, ...lesson.closingSections!])
    assert.equal(
      [...doc.querySelectorAll("h4")].filter(
        (el) => el.textContent === section.title,
      ).length,
      1,
      section.title,
    );
  assert.ok(
    doc
      .querySelector('[data-lesson-stage="formal"]')
      ?.textContent?.includes("Use equal-sized wholes."),
  );
  const print = new JSDOM(
    renderToStaticMarkup(
      React.createElement(ReferenceLesson, { lesson, print: true }),
    ),
  ).window.document;
  assert.deepEqual(
    [...print.querySelectorAll("[data-lesson-stage]")].map((el) =>
      el.getAttribute("data-lesson-stage"),
    ),
    ["intuition", "example", "method", "watch", "formal"],
  );
  assert.equal(print.querySelectorAll("h2").length, 5);
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
    method: ["Count the first group.", "Count on for the second group."],
    watch: "Count each object once.",
    example: {
      prompt: "Join 2 dots and 3 dots. How many?",
      steps: ["Start at 2 and count on 3 more: 3, 4, 5."],
      answer: "5",
    },
  };
  const doc = new JSDOM(
    renderToStaticMarkup(React.createElement(ProblemLesson, { lesson })),
  ).window.document;
  assert.deepEqual(
    [...doc.querySelectorAll("h3")].map((el) => el.textContent),
    ["Example", "Method", "Principle and definitions"],
  );
  assert.equal(
    doc.querySelector(".lesson-goal")?.textContent,
    lesson.intuition,
  );
  assert.ok(
    doc
      .querySelector(".lesson-formal")
      ?.textContent?.includes("The result of addition."),
  );
  assert.ok(
    doc
      .querySelector(".lesson-watch")!
      .compareDocumentPosition(doc.querySelector(".lesson-formal")!) & 4,
  );
});
