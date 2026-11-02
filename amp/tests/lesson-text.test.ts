import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { templates } from "../src/math/engine";
import { lessons, type Lesson } from "../src/content/lessons";
import { ReferenceLesson } from "../src/content/ReferenceLesson";
import { ProblemLesson } from "../src/web/ProblemLesson";
import {
  problemLesson,
  type ProblemLessonView,
} from "../src/content/problem-lessons";
import {
  bandBelow,
  problemLessonBlocks,
  referenceLessonBlocks,
  type LessonTextBlock,
} from "../src/content/lesson-text";
import { lessonUnits, renderUnit } from "../src/content/lesson-units";

// Reviewers and the plain-language judge must read exactly the text a learner
// sees, in the order the renderer shows it.

/** The rendered page as plain text. */
const pageText = (html: string) =>
  html
    .replace(/<annotation[^>]*>.*?<\/annotation>/g, " ")
    // A glossary term reads as its word: the control and its raised "?"
    // (decoration, hidden from reading) add nothing to the text.
    .replace(
      /<button[^>]*class="glossary-term"[^>]*>([^<]*)<span class="glossary-term-mark"[^>]*>\?<\/span><\/button>/g,
      "$1",
    )
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ");

/** A run of three or four plain words (three letters or more) from a line (math and formulas are
 * typeset, so they are not compared), or null when the line has none. */
function anchor(line: string) {
  const words = line
    .replace(/^(Problem|Step \d+|Choice \d+|Answer):\s*/, "")
    .replace(/\$[^$]*\$/g, " | ")
    .split(/\s+/);
  let run: string[] = [];
  for (const word of words) {
    if (/^[A-Za-z][a-z’']{2,},?$/.test(word)) {
      run.push(word);
      if (run.length === 4) break;
    } else if (run.length >= 3) break;
    else run = [];
  }
  return run.length >= 3 ? run.join(" ").replace(/,$/, "") : null;
}

/** Every walked line's anchor appears on the page, in walked order. */
function assertOrder(blocks: LessonTextBlock[], html: string, id: string) {
  const page = pageText(html);
  let at = 0;
  let checked = 0;
  for (const block of blocks)
    for (const line of block.lines) {
      if (/^(Figure|Illustration): /.test(line)) continue;
      const a = anchor(line);
      if (!a) continue;
      const found = page.indexOf(a, at);
      assert.ok(found >= 0, `${id} ${block.label}: "${a}" is shown, in order`);
      at = found;
      checked++;
    }
  return checked;
}

// Figures need a browser and carry no text; render without them.
const textOnlyLesson = (lesson: Lesson): Lesson => ({
  ...lesson,
  workedExample: { ...lesson.workedExample, figure: undefined },
  sections: lesson.sections.map((s) => ({ ...s, illustration: undefined })),
  closingSections: lesson.closingSections?.map((s) => ({
    ...s,
    illustration: undefined,
  })),
});
const textOnlyView = (view: ProblemLessonView): ProblemLessonView => {
  const { video: _video, ...rest } = view;
  const { figure: _figure, givens: _givens, ...example } = view.example;
  return { ...rest, example };
};

test("reference lesson text follows the rendered page", () => {
  let checked = 0;
  for (const lesson of lessons) {
    const html = renderToStaticMarkup(
      React.createElement(ReferenceLesson, { lesson: textOnlyLesson(lesson) }),
    );
    const rendered = [...html.matchAll(/data-lesson-stage="([a-z]+)"/g)].map(
      (m) => m[1],
    );
    const blocks = referenceLessonBlocks(lesson);
    const walked = blocks
      .filter((b) => b.stage !== "partner")
      .map((b) => (b.stage === "summary" ? "intuition" : b.stage))
      .filter((stage, i, all) => stage !== all[i - 1]);
    assert.deepEqual(walked, rendered, lesson.id);
    checked += assertOrder(blocks, html, lesson.id);
  }
  assert.ok(checked > lessons.length * 5, `${checked} lines compared`);
});

test("problem lesson text follows the rendered page", () => {
  let checked = 0;
  // Every 7th template keeps the test quick while covering every strand.
  for (const template of templates.filter((_, i) => i % 7 === 0)) {
    const view = problemLesson(template.id, "lesson-text");
    const html = renderToStaticMarkup(
      React.createElement(ProblemLesson, { lesson: textOnlyView(view) }),
    );
    checked += assertOrder(problemLessonBlocks(view), html, template.id);
  }
  assert.ok(checked > 300, `${checked} lines compared`);
});

test("lesson units cover every template once and render text", () => {
  const units = lessonUnits();
  assert.equal(new Set(units.map((u) => u.id)).size, units.length);
  const taught = units.flatMap((u) => u.templateIds);
  for (const t of templates)
    assert.ok(taught.includes(t.id), `${t.id} belongs to a unit`);
  const templateUnits = units.filter((u) => u.kind === "template");
  assert.equal(
    new Set(templateUnits.flatMap((u) => u.templateIds)).size,
    templateUnits.length,
  );
  // One unit per band, rendered in full: every part has an example and a
  // method, and the text is reproducible.
  const seen = new Set<string>();
  for (const unit of units) {
    if (seen.has(unit.band)) continue;
    seen.add(unit.band);
    const first = renderUnit(unit);
    assert.deepEqual(renderUnit(unit), first, unit.id);
    assert.ok(first.parts.length >= 1, unit.id);
    for (const part of first.parts) {
      const stages = part.blocks.map((b) => b.stage);
      for (const stage of ["example", "method"] as const)
        assert.ok(stages.includes(stage), `${unit.id} ${part.label} ${stage}`);
      assert.ok(
        part.blocks.every((b) => b.lines.every((l) => l.trim().length > 0)),
        `${unit.id} ${part.label} has no empty lines`,
      );
    }
  }
  assert.ok(seen.size >= 10, "units span the grade bands");
});

test("the judge reads as a learner one band below", () => {
  assert.equal(bandBelow("K"), null);
  assert.equal(bandBelow("1"), "K");
  assert.equal(bandBelow("algebra-1"), "8");
  assert.equal(bandBelow("geometry"), "algebra-1");
  assert.equal(bandBelow("precalculus"), "algebra-2");
});
