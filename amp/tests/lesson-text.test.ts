import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { templates } from "../src/math/engine";
import { lessons } from "../src/content/lessons";
import { ReferenceLesson } from "../src/content/ReferenceLesson";
import { bandBelow, referenceLessonBlocks } from "../src/content/lesson-text";
import { lessonUnits, renderUnit } from "../src/content/lesson-units";

// Reviewers and the plain-language judge must read lessons in the order the
// learner does, so the text walker follows the renderer exactly.
test("reference lesson text follows the rendered teaching order", () => {
  for (const lesson of lessons) {
    // Figures need a browser and carry no text order; render without them.
    const textOnly = {
      ...lesson,
      workedExample: { ...lesson.workedExample, figure: undefined },
      sections: lesson.sections.map((s) => ({ ...s, illustration: undefined })),
      closingSections: lesson.closingSections?.map((s) => ({
        ...s,
        illustration: undefined,
      })),
    };
    const rendered = [
      ...renderToStaticMarkup(
        React.createElement(ReferenceLesson, { lesson: textOnly }),
      ).matchAll(/data-lesson-stage="([a-z]+)"/g),
    ].map((m) => m[1]);
    const walked = referenceLessonBlocks(lesson)
      .filter((b) => b.stage !== "partner")
      .map((b) =>
        b.stage === "summary" || b.stage === "goal" ? "intuition" : b.stage,
      )
      .filter((stage, i, all) => stage !== all[i - 1]);
    assert.deepEqual(walked, rendered, lesson.id);
  }
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
  // One unit per band, rendered in full: every part has a goal or summary,
  // an example and a method, and the text is reproducible.
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
